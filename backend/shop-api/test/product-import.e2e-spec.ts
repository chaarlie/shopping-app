import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

const challengeCsv = readFileSync(
  fileURLToPath(
    new URL('../../Code Challenge E-Commerce.csv', import.meta.url),
  ),
  'utf8',
);

describe('Product import (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE products RESTART IDENTITY');
  });

  afterAll(async () => {
    await app.close();
  });

  const upload = (csv: string, query = '') =>
    request(app.getHttpServer())
      .post(`/api/products/import${query}`)
      .attach('file', Buffer.from(csv), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

  const productCount = async () =>
    Number(
      (await dataSource.query('SELECT count(*) AS count FROM products'))[0]
        .count,
    );

  it('previews the challenge CSV without writing anything', async () => {
    const { body } = await upload(challengeCsv, '?dryRun=true').expect(200);

    expect(body).toMatchObject({
      dryRun: true,
      totalRows: 97,
      blankRows: 2,
      counts: {
        create: 85,
        update: 0,
        unchanged: 0,
        skip: 0,
        duplicate: 0,
        error: 10,
      },
    });
    expect(await productCount()).toBe(0);
  });

  it('imports the challenge CSV in one go', async () => {
    const { body } = await upload(challengeCsv).expect(200);

    expect(body.counts.create).toBe(85);
    expect(await productCount()).toBe(85);

    const [stored] = await dataSource.query(
      "SELECT name FROM products WHERE sku = 'XS-001'",
    );
    expect(stored.name).toBe("<script>alert('xss')</script>");
  });

  it('changes nothing when the same file is imported again', async () => {
    await upload(challengeCsv).expect(200);

    const { body } = await upload(challengeCsv).expect(200);

    expect(body.counts).toMatchObject({ create: 0, update: 0, unchanged: 85 });
    const [{ max }] = await dataSource.query(
      'SELECT max(version) AS max FROM products',
    );
    expect(max).toBe(1);
  });

  it('updates products whose values changed', async () => {
    await upload(challengeCsv).expect(200);
    const changed = challengeCsv.replace(
      'Wireless Mouse,WM-042,Ergonomic wireless mouse with USB receiver,Electronics,$29.99,75,0.12',
      'Wireless Mouse,WM-042,Ergonomic wireless mouse with USB receiver,Electronics,27.50,60,0.12',
    );

    const { body } = await upload(changed).expect(200);

    expect(body.counts).toMatchObject({ update: 1, unchanged: 84 });
    const [mouse] = await dataSource.query(
      "SELECT price_cents, stock, version FROM products WHERE sku = 'WM-042'",
    );
    expect(mouse).toEqual({ price_cents: 2750, stock: 60, version: 2 });
  });

  it('keeps existing products when asked to skip them', async () => {
    await upload(challengeCsv).expect(200);
    const changed = challengeCsv.replace(',$29.99,75,', ',27.50,60,');

    const { body } = await upload(changed, '?onExisting=skip').expect(200);

    expect(body.counts).toMatchObject({ skip: 1, update: 0 });
    const [mouse] = await dataSource.query(
      "SELECT stock FROM products WHERE sku = 'WM-042'",
    );
    expect(mouse.stock).toBe(75);
  });

  it('reports why each rejected row was rejected', async () => {
    const { body } = await upload(challengeCsv, '?dryRun=true').expect(200);
    const yogaMat = body.rows.find((row: { row: number }) => row.row === 7);

    expect(yogaMat).toMatchObject({
      status: 'error',
      errors: ['Price "free" is not a valid amount'],
      values: { sku: 'YM-015', price: 'free' },
    });
  });

  it('rejects a request without a file', () => {
    return request(app.getHttpServer())
      .post('/api/products/import')
      .expect(400);
  });

  it('rejects a file without the expected columns', async () => {
    const { body } = await upload('name,sku\nMug,MG-1').expect(400);

    expect(body.message).toBe(
      'The file is missing these columns: description, category, price, stock, weight_kg',
    );
  });

  it('rejects a file larger than 1 MB', () => {
    return upload('x'.repeat(1_000_001)).expect(413);
  });
});
