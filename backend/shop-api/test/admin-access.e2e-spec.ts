import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { adminRequest, seedAdmin } from './admin-fixture.js';
describe('admin sessions', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = setupApp(module.createNestApplication());
    await app.init();
    await seedAdmin(app);
  });
  afterAll(async () => {
    await app.close();
  });
  const login = (ip: string) =>
    request(app.getHttpServer())
      .post('/api/admin/sign-in')
      .set('X-Forwarded-For', ip)
      .send({ email: 'test@example.test', password: 'test-password-123' });
  it('requires a session for every catalog mutation and import history', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/products/1')
      .send({})
      .expect(401);
    await request(app.getHttpServer()).delete('/api/products/1').expect(401);
    await request(app.getHttpServer()).post('/api/products/import').expect(401);
    await request(app.getHttpServer()).get('/api/admin/session').expect(401);
  });
  it('keeps browsing and checkout public', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(200);
    await request(app.getHttpServer()).get('/api/categories').expect(200);
    await request(app.getHttpServer()).post('/api/orders').send({}).expect(400);
  });
  it('sets a protected cookie and revokes sessions on sign-out', async () => {
    const response = await login('192.0.2.1').expect(200);
    const cookie = String(response.headers['set-cookie'][0]);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    await request(app.getHttpServer())
      .get('/api/admin/session')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/admin/sign-out')
      .set('Cookie', cookie)
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/admin/session')
      .set('Cookie', cookie)
      .expect(401);
  });
  it('rejects expired sessions', async () => {
    const response = await login('192.0.2.2').expect(200);
    await app
      .get(DataSource)
      .query("UPDATE admin_sessions SET expires_at=now()-interval '1 second'");
    await request(app.getHttpServer())
      .get('/api/admin/session')
      .set('Cookie', response.headers['set-cookie'])
      .expect(401);
  });
  it('rejects another origin even on sign-in and public checkout', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/sign-in')
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
  });
  it('limits login attempts per client IP', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/admin/sign-in')
        .set('X-Forwarded-For', '192.0.2.10')
        .send({ email: 'unknown@example.test', password: 'wrong' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/admin/sign-in')
      .set('X-Forwarded-For', '192.0.2.10')
      .send({ email: 'unknown@example.test', password: 'wrong' })
      .expect(429);
    await login('192.0.2.11').expect(200);
  });
  it('lists and filters reorder products without using the search index', async () => {
    await seedAdmin(app);
    await app
      .get(DataSource)
      .query(
        "INSERT INTO products(sku,name,category,price_cents,stock) VALUES('ADMIN-ZERO','Admin listing test zero','Kitchen',100,0),('ADMIN-STOCK','Admin listing test stocked','Kitchen',100,3)",
      );
    await request(app.getHttpServer()).get('/api/admin/products').expect(401);
    const { body } = await adminRequest(app)
      .get(
        '/api/admin/products?q=Admin%20listing%20test&reorder=true&pageSize=14',
      )
      .expect(200);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ sku: 'ADMIN-ZERO', stock: 0 });
    const { body: all } = await adminRequest(app)
      .get('/api/admin/products?q=Admin%20listing%20test&pageSize=1&page=2')
      .expect(200);
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(1);
  });
});
