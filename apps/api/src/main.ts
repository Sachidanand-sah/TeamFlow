import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'node:path';
import { AppModule } from './app/app.module';
import { EnvironmentVariables } from './config/env.validation';
import { CorsIoAdapter } from './modules/realtime/cors-io.adapter';
import { serveWebApp } from './web-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Behind a hosting proxy (Render, etc.) the socket address is the proxy's. Trusting
  // ONE hop makes req.ip the real client IP, so rate limits apply per visitor instead
  // of to everyone at once. Only enable where a proxy really sits in front.
  if (config.get('TRUST_PROXY', { infer: true })) {
    app.set('trust proxy', 1);
  }

  // Secure HTTP headers. The CSP also covers the Angular app when it is served from
  // here: scripts only from our origin; network calls only to our origin and to the
  // object storage host (browser uploads/downloads use signed URLs there).
  const storageOrigin = new URL(config.get('S3_ENDPOINT', { infer: true }))
    .origin;
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'connect-src': ["'self'", storageOrigin],
          'img-src': ["'self'", 'data:'],
        },
      },
    }),
  );
  // Parses the Cookie header so the refresh-token cookie can be read.
  app.use(cookieParser());
  // Only the configured web origin may call the API with credentials (cookies).
  const corsOrigin = config.get('CORS_ORIGIN', { infer: true });
  app.enableCors({ origin: corsOrigin, credentials: true });
  // Same CORS rule for the Socket.IO real-time endpoint.
  app.useWebSocketAdapter(new CorsIoAdapter(app, corsOrigin));
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties without decorators and reject requests that send them, so
      // clients can never set fields we did not plan for (mass assignment).
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  // Run onModuleDestroy hooks (e.g. close DB connections) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  if (config.get('SERVE_WEB_APP', { infer: true })) {
    serveWebApp(app, join(process.cwd(), 'dist/apps/web/browser'));
  }

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on port ${port} (/api)`, 'Bootstrap');
}

void bootstrap();
