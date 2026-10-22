import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ok'));
  });

  it('/api/health/ready (GET) reports the database as up', () => {
    return request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect(({ body }) =>
        expect(body.details.database.status).toBe('up'),
      );
  });

  it('serves routes only under /api', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
