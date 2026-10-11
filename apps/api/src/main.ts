import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { EnvironmentVariables } from './config/env.validation';
import { CorsIoAdapter } from './modules/realtime/cors-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Secure HTTP headers (no MIME sniffing, no framing, HSTS, ...).
  app.use(helmet());
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

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
