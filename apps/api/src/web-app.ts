import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Paths the Angular app must never shadow. */
const API_PATHS = /^\/(api|socket\.io)(\/|$)/;

/**
 * In production the API also serves the built Angular app.
 *
 * WHY one origin: the refresh-token cookie is SameSite=Strict and scoped to
 * /api/auth. If the web app lived on another domain, the browser would treat the API
 * as a third party and never send that cookie, and WebSockets would need cross-site
 * setup. Same origin keeps the security model from ADR 0002 intact, for free.
 */
export function serveWebApp(app: NestExpressApplication, dir: string): void {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) {
    Logger.warn(`SERVE_WEB_APP is on but ${index} is missing`, 'WebApp');
    return;
  }

  // Hashed bundles (main-ABC123.js) never change: cache them for a year.
  // index.html must always be revalidated so new deploys are picked up.
  app.useStaticAssets(dir, {
    index: false,
    setHeaders: (res, path) => {
      res.setHeader(
        'Cache-Control',
        path.endsWith('.html')
          ? 'no-cache'
          : 'public, max-age=31536000, immutable',
      );
    },
  });

  // SPA fallback: any other GET that is not the API returns index.html, so deep
  // links like /workspaces/123 work after a page reload.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || API_PATHS.test(req.path)) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
