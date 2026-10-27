import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { adminRequest, seedAdmin } from './admin-fixture.js';
import { ImportObjectStore } from '../src/imports/storage/import-object-store.js';
import { ImportUploadJob } from '../src/imports/uploads/import-upload.job.js';
import { ImportUploadJobRepository } from '../src/imports/uploads/import-upload-job.repository.js';
import { StageUploadCommand } from '../src/imports/uploads/stage-upload-command.handler.js';
import { planProductImport } from '../src/products/import/plan-product-import.js';
const header = 'name,sku,description,category,price,stock,weight_kg\n';
const storage = {
  read: vi.fn(),
  abort: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
};
function catalog(bytes: number) {
  const count = Math.ceil(bytes / 2100);
  const name = 'N'.repeat(180);
  const row = (index: number, description: string) =>
    `${name},L-${String(index).padStart(5, '0')},${description},Kitchen,1.00,2,0.1\n`;
  const available = bytes - header.length - count * row(0, '').length;
  const width = Math.floor(available / count);
  const remainder = available % count;
  return {
    file: Buffer.from(
      header +
        Array.from({ length: count }, (_, index) =>
          row(index, 'd'.repeat(width + (index < remainder ? 1 : 0))),
        ).join(''),
    ),
    count,
  };
}
describe('durable object import processing', () => {
  let app: INestApplication;
  let db: DataSource;
  let worker: ImportUploadJob;
  let adminId: number;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ImportObjectStore)
      .useValue(storage)
      .compile();
    app = setupApp(module.createNestApplication());
    await app.init();
    db = app.get(DataSource);
    worker = app.get(ImportUploadJob);
    await seedAdmin(app);
    [{ id: adminId }] = await db.query(
      "SELECT id FROM admins WHERE email='test@example.test'",
    );
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE product_imports,products RESTART IDENTITY CASCADE',
    );
    vi.resetAllMocks();
    storage.download.mockResolvedValue('http://storage.test/original');
  });
  afterAll(async () => {
    await app.close();
  });
  const enqueue = async (file: Buffer) => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO import_uploads(id,admin_id,filename,size,object_key,state) VALUES($1,$2,'catalog.csv',$3,$4,'queued')",
      [id, adminId, file.length, `tests/${id}`],
    );
    storage.read.mockImplementation(() => Readable.from([file]));
    return id;
  };
  it.each([5_000_000, 10_000_000])(
    'stages and atomically applies an exact %i-byte catalog',
    async (bytes) => {
      const { file, count } = catalog(bytes);
      expect(file.length).toBe(bytes);
      const id = await enqueue(file);
      await worker.runOnce();
      const [job] = await db.query('SELECT * FROM import_uploads WHERE id=$1', [
        id,
      ]);
      expect(job.state).toBe('ready');
      const [stored] = await db.query(
        'SELECT file,object_key,file_size FROM product_imports WHERE id=$1',
        [job.import_id],
      );
      expect(stored.file).toBeNull();
      expect(stored.file_size).toBe(bytes);
      expect(stored.object_key).toBe(`tests/${id}`);
      const { body: preview } = await adminRequest(app)
        .get(`/api/admin/imports/${job.import_id}`)
        .expect(200);
      expect(preview.total).toBe(count);
      expect(preview.summary.counts.create).toBe(count);
      await adminRequest(app)
        .post(`/api/admin/imports/${job.import_id}/apply`)
        .send({ version: preview.summary.version })
        .expect(201);
      expect(
        Number((await db.query('SELECT count(*) FROM products'))[0].count),
      ).toBe(count);
      await worker.runOnce();
      expect(
        Number(
          (await db.query('SELECT count(*) FROM product_imports'))[0].count,
        ),
      ).toBe(1);
      await adminRequest(app)
        .get(`/api/admin/imports/${job.import_id}/file`)
        .expect(302)
        .expect('Location', 'http://storage.test/original');
    },
    30000,
  );
  it('recovers an expired lease and fences out the previous worker', async () => {
    const file = Buffer.from(header + 'Mug,MG-1,Blue,Kitchen,9.99,10,0.3');
    const id = await enqueue(file);
    const oldToken = randomUUID();
    await app.get(ImportUploadJobRepository).claim(oldToken);
    await db.query(
      "UPDATE import_uploads SET lease_until=now()-interval '1 second' WHERE id=$1",
      [id],
    );
    await worker.runOnce();
    await app
      .get(CommandBus)
      .execute(
        new StageUploadCommand(
          id,
          oldToken,
          file,
          planProductImport(file.toString()),
          null,
        ),
      );
    expect(
      Number((await db.query('SELECT count(*) FROM product_imports'))[0].count),
    ).toBe(1);
    expect(
      (await db.query('SELECT state FROM import_uploads WHERE id=$1', [id]))[0]
        .state,
    ).toBe('ready');
  });
  it('preserves a parse failure for review and rejects too many records', async () => {
    const file = Buffer.from(header + '\n'.repeat(5001));
    const id = await enqueue(file);
    await worker.runOnce();
    const [job] = await db.query('SELECT * FROM import_uploads WHERE id=$1', [
      id,
    ]);
    expect(job.state).toBe('ready');
    const { body } = await adminRequest(app)
      .get(`/api/admin/imports/${job.import_id}`)
      .expect(200);
    expect(body.summary.fileError).toContain('5000 row limit');
    expect(body.rows).toEqual([]);
    await adminRequest(app)
      .post(`/api/admin/imports/${job.import_id}/apply`)
      .send({ version: body.summary.version })
      .expect(400);
  });
  it('cleans an expired upload without removing completed originals', async () => {
    const id = await enqueue(Buffer.from(header));
    await db.query(
      "UPDATE import_uploads SET state='uploading',multipart_id='expired',expires_at=now()-interval '1 second' WHERE id=$1",
      [id],
    );
    await worker.runOnce();
    expect(storage.abort).toHaveBeenCalledWith(`tests/${id}`, 'expired');
    expect(storage.remove).toHaveBeenCalledWith(`tests/${id}`);
    expect(
      (
        await db.query(
          'SELECT state,cleaned_at FROM import_uploads WHERE id=$1',
          [id],
        )
      )[0],
    ).toMatchObject({ state: 'cancelled', cleaned_at: expect.any(Date) });
  });
});
