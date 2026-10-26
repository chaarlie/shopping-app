import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { adminRequest, seedAdmin } from './admin-fixture.js';
const header = 'name,sku,description,category,price,stock,weight_kg';
const csv = header + '\nMug,MG-1,Blue mug,Kitchen,9.99,10,0.3';
describe('stored import review', () => {
  let app: INestApplication;
  let db: DataSource;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = setupApp(module.createNestApplication());
    await app.init();
    db = app.get(DataSource);
    await seedAdmin(app);
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE product_imports,products RESTART IDENTITY CASCADE',
    );
  });
  afterAll(async () => {
    await app.close();
  });
  const upload = (text = csv) =>
    adminRequest(app)
      .post('/api/admin/imports')
      .attach('file', Buffer.from(text), 'catalog.csv');
  it('stores the original file and audited edits, then applies atomically once', async () => {
    const { body: summary } = await upload().expect(201);
    const { body: preview } = await adminRequest(app)
      .get(`/api/admin/imports/${summary.id}`)
      .expect(200);
    expect(preview.rows[0].values.name).toBe('Mug');
    const edited = await adminRequest(app)
      .patch(`/api/admin/imports/${summary.id}/rows/2`)
      .send({
        version: summary.version,
        values: { ...preview.rows[0].values, name: 'New mug' },
      })
      .expect(200);
    await adminRequest(app)
      .post(`/api/admin/imports/${summary.id}/apply`)
      .send({ version: edited.body.version })
      .expect(201);
    const [{ name, version }] = await db.query(
      'SELECT name,version FROM products',
    );
    expect(name).toBe('New mug');
    expect(version).toBe(1);
    const [file] = await db.query('SELECT file FROM product_imports');
    expect(file.file.toString('utf8')).toBe(csv);
    expect(await db.query('SELECT * FROM product_import_edits')).toHaveLength(
      1,
    );
    const { body: after } = await adminRequest(app)
      .get(`/api/admin/imports/${summary.id}`)
      .expect(200);
    await adminRequest(app)
      .post(`/api/admin/imports/${summary.id}/apply`)
      .send({ version: after.summary.version })
      .expect(201);
    expect(await db.query('SELECT * FROM products')).toHaveLength(1);
  });
  it('rejects stale import edits and changed catalog previews', async () => {
    const { body: s } = await upload().expect(201);
    await adminRequest(app)
      .patch(`/api/admin/imports/${s.id}/rows/2`)
      .send({ version: s.version - 1, excluded: true })
      .expect(409);
    await db.query(
      "INSERT INTO products(sku,name,category,price_cents,stock) VALUES('OTHER','Other','Kitchen',100,1)",
    );
    await adminRequest(app)
      .post(`/api/admin/imports/${s.id}/apply`)
      .send({ version: s.version })
      .expect(409);
    expect(
      await db.query("SELECT * FROM products WHERE sku='MG-1'"),
    ).toHaveLength(0);
  });
  it('requires a duplicate SKU decision and permits excluding one conflicting row', async () => {
    const { body: s } = await upload(
      csv + '\nAnother mug,MG-1,Other,Kitchen,12.00,5,0.3',
    ).expect(201);
    await adminRequest(app)
      .post(`/api/admin/imports/${s.id}/apply`)
      .send({ version: s.version })
      .expect(409);
    const { body: e } = await adminRequest(app)
      .patch(`/api/admin/imports/${s.id}/rows/3`)
      .send({ version: s.version, excluded: true })
      .expect(200);
    await adminRequest(app)
      .post(`/api/admin/imports/${s.id}/apply`)
      .send({ version: e.version })
      .expect(201);
    expect(await db.query('SELECT * FROM products')).toHaveLength(1);
  });
  it('preserves sold stock by default and updates it only after explicit opt-in', async () => {
    await db.query(
      "INSERT INTO products(sku,name,description,category,price_cents,stock,weight_grams) VALUES('MG-1','Mug','Blue mug','Kitchen',999,3,300)",
    );
    const { body: s } = await upload().expect(201);
    await adminRequest(app)
      .post(`/api/admin/imports/${s.id}/apply`)
      .send({ version: s.version })
      .expect(201);
    expect((await db.query('SELECT stock FROM products'))[0].stock).toBe(3);
    const { body: next } = await upload().expect(201);
    const { body: review } = await adminRequest(app)
      .post(`/api/admin/imports/${next.id}/refresh`)
      .send({ version: next.version, updateStock: true })
      .expect(201);
    await adminRequest(app)
      .post(`/api/admin/imports/${next.id}/apply`)
      .send({ version: review.version })
      .expect(201);
    expect((await db.query('SELECT stock FROM products'))[0].stock).toBe(10);
  });
  it('clamps negative stock and keeps its shortfall warning', async () => {
    const { body: s } = await upload(csv.replace(',10,', ',-5,')).expect(201);
    const { body: p } = await adminRequest(app)
      .get(`/api/admin/imports/${s.id}`)
      .expect(200);
    expect(p.rows[0].warnings).toContain('-5 → 0 · order at least 5');
    await adminRequest(app)
      .post(`/api/admin/imports/${s.id}/apply`)
      .send({ version: s.version })
      .expect(201);
    expect((await db.query('SELECT stock FROM products'))[0].stock).toBe(0);
  });
  it('retains malformed files in history without allowing application', async () => {
    const { body: summary } = await upload('invalid,header\nvalue,row').expect(
      201,
    );
    expect(summary.fileError).toBeTruthy();
    expect(
      (await db.query('SELECT file FROM product_imports'))[0].file.toString(),
    ).toBe('invalid,header\nvalue,row');
    await adminRequest(app)
      .post(`/api/admin/imports/${summary.id}/apply`)
      .send({ version: summary.version })
      .expect(400);
    expect(await db.query('SELECT * FROM products')).toHaveLength(0);
  });
  it('paginates and filters rows on the server', async () => {
    const { body: s } = await upload(
      header +
        '\n' +
        Array.from(
          { length: 20 },
          (_, i) => `Mug,MG-${i},Blue,Kitchen,9.99,1,0.3`,
        ).join('\n'),
    ).expect(201);
    const { body: p } = await adminRequest(app)
      .get(`/api/admin/imports/${s.id}?page=2&pageSize=15`)
      .expect(200);
    expect(p.rows).toHaveLength(5);
    expect(p.total).toBe(20);
  });
});
