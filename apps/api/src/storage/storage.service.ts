import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
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
      // MinIO serves buckets as paths (host/bucket/key), not subdomains.
      forcePathStyle: true,
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
   * A signed POST policy for exactly one object. Storage rejects the upload unless
   * the size and Content-Type match, so the client cannot swap in a larger or
   * different file than it declared.
   */
  async createUpload(
    key: string,
    contentType: string,
    size: number,
  ): Promise<PresignedUpload> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', size, size],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: UPLOAD_URL_TTL_SECONDS,
    });
    return { url, fields };
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
   * Short-lived download link that forces "save as" with the original name.
   * WHY `attachment`: even an allowed type should never be rendered inline on the
   * storage origin; downloading is the safe default for user-supplied files.
   */
  downloadUrl(key: string, fileName: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(fileName),
      }),
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
