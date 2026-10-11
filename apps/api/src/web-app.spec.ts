import { Controller, Get, Module } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { serveWebApp } from './web-app';

@Controller('health')
class HealthTestController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthTestController] })
class TestModule {}

describe('serveWebApp', () => {
  let dir: string;
  let app: NestExpressApplication;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tf-web-'));
    writeFileSync(join(dir, 'index.html'), '<html>TeamFlow</html>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'main-ABC123.js'), 'console.log(1)');

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    serveWebApp(app, dir);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves hashed bundles with long-lived caching', async () => {
    const res = await request(app.getHttpServer()).get('/main-ABC123.js');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('returns index.html for deep links (SPA fallback), never cached', async () => {
    const res = await request(app.getHttpServer()).get('/workspaces/123');

    expect(res.status).toBe(200);
    expect(res.text).toContain('TeamFlow');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('leaves API routes to the API', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('does not turn unknown API paths into the web app', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('TeamFlow');
  });
});
