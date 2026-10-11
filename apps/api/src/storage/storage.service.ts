import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PresignedUpload } from '@teamflow/shared';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60;

export interface StoredObjectInfo {
  size: number;
  contentType: string | undefined;
}

/**
 * The only place that talks to S3/MinIO. Everything else uses this small interface,
 * so swapping providers or faking storage in tests touches one file.
 *
 * WHY presigned URLs: the browser sends/receives file bytes directly to/from storage.
 * The API never buffers uploads in memory (no large-file DoS) and stays stateless.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      // MinIO/Supabase serve buckets as paths (host/bucket/key), not subdomains.
      forcePathStyle: true,
      // Recent SDK versions add CRC32 checksums to uploads by default. Browsers
      // uploading through a presigned URL cannot send them, and several
      // S3-compatible services reject them, so only add checksums where required.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
    });
  }

  /** Dev convenience: create the bucket if missing. Production buckets are provisioned. */
  async onModuleInit(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production) {
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created bucket ${this.bucket}`);
      } catch (error) {
        // Do not block startup when MinIO is down; uploads will fail until it is up.
        // (A refused connection is an AggregateError with an empty message.)
        const reason =
          error instanceof Error ? error.message || error.name : String(error);
        this.logger.warn(
          `Object storage unavailable at ${this.config.get('S3_ENDPOINT', { infer: true })}: ${reason}`,
        );
      }
    }
  }

  /**
   * A presigned PUT for exactly one object.
   *
   * Content-Type, Content-Length and Content-Disposition are part of the SIGNATURE,
   * so storage rejects the upload if the browser sends a different type, a different
   * size, or tries to change how the file is served. (The browser sets
   * Content-Length itself from the file, so a bigger file breaks the signature.)
   *
   * WHY PUT and not a POST policy: presigned PUT works on every S3-compatible service
   * (AWS, MinIO, Supabase Storage, Cloudflare R2); POST policies do not.
   */
  async createUpload(
    key: string,
    contentType: string,
    size: number,
    fileName: string,
  ): Promise<PresignedUpload> {
    const disposition = contentDisposition(fileName);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        // Stored with the object, so every later download is "save as", never inline.
        ContentDisposition: disposition,
      }),
      {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        signableHeaders: new Set([
          'content-type',
          'content-length',
          'content-disposition',
        ]),
      },
    );
    return {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
      },
    };
  }

  /** Size and type of a stored object, or null if it does not exist. */
  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: result.ContentLength ?? -1,
        contentType: result.ContentType,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Short-lived download link. The object was stored with
   * `Content-Disposition: attachment` (see createUpload), so it downloads as a file
   * with its original name instead of rendering inline on the storage origin.
   * (Not using the `response-content-disposition` override: not every
   * S3-compatible service documents support for it.)
   */
  downloadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Deletes every object under a prefix (e.g. all files of a deleted task). */
  async deletePrefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const keys = (page.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

/**
 * RFC 6266/5987 header: an ASCII fallback plus the exact UTF-8 name, so names like
 * "Überblick.pdf" survive and quotes cannot break out of the header.
 */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
