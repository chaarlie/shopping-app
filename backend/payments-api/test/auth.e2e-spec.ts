import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { Public } from './../src/auth/decorators/public.decorator.js';

@Controller('probe')
class ProbeController {
  @Get('private')
  getPrivate() {
    return { reached: true };
  }

  @Public()
  @Get('public')
  getPublic() {
    return { reached: true };
  }
}

describe('API key guard (e2e)', () => {
  const apiKey = process.env.PAYMENTS_API_KEY ?? '';
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects a request without an API key', () => {
    return request(app.getHttpServer()).get('/probe/private').expect(401);
  });

  it('rejects a request with a wrong API key', () => {
    return request(app.getHttpServer())
      .get('/probe/private')
      .set('Authorization', `Bearer ${'x'.repeat(apiKey.length)}`)
      .expect(401);
  });

  it('rejects a key sent without the Bearer scheme', () => {
    return request(app.getHttpServer())
      .get('/probe/private')
      .set('Authorization', apiKey)
      .expect(401);
  });

  it('accepts a request with the API key', () => {
    return request(app.getHttpServer())
      .get('/probe/private')
      .set('Authorization', `Bearer ${apiKey}`)
      .expect(200, { reached: true });
  });

  it('lets a public route through without a key', () => {
    return request(app.getHttpServer()).get('/probe/public').expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
