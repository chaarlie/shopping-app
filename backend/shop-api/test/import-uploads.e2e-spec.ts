import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { adminRequest, seedAdmin } from './admin-fixture.js';
import { ImportObjectStore } from '../src/imports/storage/import-object-store.js';
const storage = {
  start: vi.fn(),
  signPart: vi.fn(),
  parts: vi.fn(),
  complete: vi.fn(),
  size: vi.fn(),
  abort: vi.fn(),
  remove: vi.fn(),
};
describe('multipart upload sessions', () => {
  let app: INestApplication;
  let db: DataSource;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ImportObjectStore)
      .useValue(storage)
      .compile();
    app = setupApp(module.createNestApplication());
    await app.init();
    db = app.get(DataSource);
    await seedAdmin(app);
  });
  beforeEach(async () => {
    await db.query('TRUNCATE import_uploads');
    vi.resetAllMocks();
    storage.start.mockResolvedValue('multipart-1');
    storage.signPart.mockResolvedValue('http://storage.test/signed');
    storage.parts.mockResolvedValue([{ number: 1, size: 10, etag: 'part-1' }]);
    storage.size.mockResolvedValue(null);
    storage.complete.mockImplementation(() => {
      storage.size.mockResolvedValue(10);
    });
  });
  afterAll(async () => {
    await app.close();
  });
  const start = () =>
    adminRequest(app)
      .post('/api/admin/import-uploads')
      .send({ filename: 'catalog.csv', size: 10 });
  it('requires a session and rejects oversized declarations', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/import-uploads')
      .send({ filename: 'x.csv', size: 10 })
      .expect(401);
    await adminRequest(app)
      .post('/api/admin/import-uploads')
      .send({ filename: 'x.csv', size: 10_000_001 })
      .expect(400);
    expect(storage.start).not.toHaveBeenCalled();
  });
  it('enforces the configured five MB default below the ten MB hard limit', async () => {
    await adminRequest(app)
      .post('/api/admin/import-uploads')
      .send({ filename: 'x.csv', size: 5_000_001 })
      .expect(400);
    expect(storage.start).not.toHaveBeenCalled();
  });
  it('verifies parts, queues once and recovers a lost completion response', async () => {
    const { body } = await start().expect(201);
    await adminRequest(app)
      .get(`/api/admin/import-uploads/${body.id}/parts/1`)
      .expect(200);
    await adminRequest(app)
      .get(`/api/admin/import-uploads/${body.id}/parts/2`)
      .expect(409);
    storage.complete.mockImplementationOnce(() => {
      storage.size.mockResolvedValue(10);
      throw new Error('connection lost after completion');
    });
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/complete`)
      .expect(500);
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/complete`)
      .expect(201)
      .expect((res) => expect(res.body.state).toBe('queued'));
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/complete`)
      .expect(201);
    expect(storage.complete).toHaveBeenCalledTimes(1);
    expect(await db.query('SELECT state FROM import_uploads')).toEqual([
      { state: 'queued' },
    ]);
  });
  it('rejects an incorrect stored part size without completing the object', async () => {
    const { body } = await start().expect(201);
    storage.parts.mockResolvedValue([{ number: 1, size: 11, etag: 'wrong' }]);
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/complete`)
      .expect(400);
    expect(storage.complete).not.toHaveBeenCalled();
  });
  it('hides another admin upload and enforces active-upload quotas', async () => {
    const { body } = await start().expect(201);
    const [other] = await db.query(
      "INSERT INTO admins(name,email,password_hash) VALUES('Other','upload-other@example.test','unused') ON CONFLICT(email) DO UPDATE SET name=excluded.name RETURNING id",
    );
    await db.query('UPDATE import_uploads SET admin_id=$2 WHERE id=$1', [
      body.id,
      other.id,
    ]);
    await adminRequest(app)
      .get(`/api/admin/import-uploads/${body.id}`)
      .expect(404);
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/complete`)
      .expect(404);
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/cancel`)
      .expect(404);
    await start().expect(201);
    await start().expect(201);
    await start().expect(409);
  });
  it('cancels and prevents new part URLs or completion', async () => {
    const { body } = await start().expect(201);
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/cancel`)
      .expect(201);
    await adminRequest(app)
      .get(`/api/admin/import-uploads/${body.id}/parts/1`)
      .expect(409);
    await adminRequest(app)
      .post(`/api/admin/import-uploads/${body.id}/complete`)
      .expect(409);
    expect(storage.abort).toHaveBeenCalledTimes(1);
  });
});
