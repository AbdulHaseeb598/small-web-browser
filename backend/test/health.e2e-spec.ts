import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { configureApp } from '../src/config/configure-app.js';
import { HealthModule } from '../src/health/health.module.js';

describe('Health API (HTTP)', () => {
  let app: INestApplication<Server>;
  const ping = vi.fn();
  const connection = { readyState: 1, db: { admin: () => ({ ping }) } };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .useMocker((token) => {
        if (token === getConnectionToken()) return connection;
      })
      .compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    await app.init();
  });

  beforeEach(() => {
    connection.readyState = 1;
    ping.mockReset().mockResolvedValue({ ok: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the prefixed health route with configured CORS', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body).toMatchObject({
          status: 'ok',
          database: 'up',
          service: 'small-web-browser-api',
        });
      });
  });

  it('does not permit a different browser origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://other.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).not.toBe(
      'https://other.example',
    );
  });

  it('does not expose an unprefixed route', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
    await request(app.getHttpServer()).get('/api').expect(404);
  });

  it('returns 503 when the database ping fails', async () => {
    ping.mockRejectedValue(new Error('private database details'));
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body).toMatchObject({ status: 'error', database: 'down' });
        expect(JSON.stringify(body)).not.toContain('private');
      });
  });
});
