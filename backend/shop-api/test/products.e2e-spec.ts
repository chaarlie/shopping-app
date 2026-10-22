import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

const runningShoes = {
  sku: 'rs-001',
  name: 'Running Shoes',
  description: 'Lightweight running shoes for daily training',
  category: 'Footwear',
  priceCents: 8999,
  stock: 150,
  weightGrams: 350,
};

describe('Products (e2e)', () => {
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

  const createProduct = (body: object) =>
    request(app.getHttpServer()).post('/api/products').send(body);

  it('creates a product and normalizes its SKU', async () => {
    const { body } = await createProduct(runningShoes).expect(201);

    expect(body).toMatchObject({
      id: 1,
      sku: 'RS-001',
      name: 'Running Shoes',
      priceCents: 8999,
      stock: 150,
      weightGrams: 350,
      version: 1,
    });
  });

  it('rejects a SKU that already exists', async () => {
    await createProduct(runningShoes).expect(201);

    const { body } = await createProduct({
      ...runningShoes,
      sku: 'RS-001 ',
    }).expect(409);

    expect(body.message).toBe('A product with SKU RS-001 already exists');
  });

  it('reports every invalid field', async () => {
    const { body } = await createProduct({
      ...runningShoes,
      priceCents: 0,
      stock: -5,
    }).expect(400);

    expect(body.issues.map((issue: { path: string }) => issue.path)).toEqual([
      'priceCents',
      'stock',
    ]);
  });

  it('rejects fields it does not know', () => {
    return createProduct({ ...runningShoes, id: 99 }).expect(400);
  });

  it('returns a product by id', async () => {
    await createProduct(runningShoes).expect(201);

    const { body } = await request(app.getHttpServer())
      .get('/api/products/1')
      .expect(200);

    expect(body.sku).toBe('RS-001');
  });

  it('returns 404 for a product that does not exist', () => {
    return request(app.getHttpServer()).get('/api/products/999').expect(404);
  });

  it('lists products in pages, sorted by name', async () => {
    await createProduct({ ...runningShoes, sku: 'A-1', name: 'Cutting Board' });
    await createProduct({ ...runningShoes, sku: 'A-2', name: 'Air Purifier' });
    await createProduct({ ...runningShoes, sku: 'A-3', name: 'Backpack' });

    const { body } = await request(app.getHttpServer())
      .get('/api/products?page=1&pageSize=2')
      .expect(200);

    expect(body.total).toBe(3);
    expect(body.items.map((item: { name: string }) => item.name)).toEqual([
      'Air Purifier',
      'Backpack',
    ]);
  });

  it('filters the list by category', async () => {
    await createProduct(runningShoes);
    await createProduct({ ...runningShoes, sku: 'B-1', category: 'Kitchen' });

    const { body } = await request(app.getHttpServer())
      .get('/api/products?category=Kitchen')
      .expect(200);

    expect(body.total).toBe(1);
    expect(body.items[0].sku).toBe('B-1');
  });

  it('updates a product when the version matches', async () => {
    await createProduct(runningShoes).expect(201);

    const { body } = await request(app.getHttpServer())
      .patch('/api/products/1')
      .send({ stock: 120, version: 1 })
      .expect(200);

    expect(body).toMatchObject({ stock: 120, version: 2, name: 'Running Shoes' });
  });

  it('rejects an update based on an old version', async () => {
    await createProduct(runningShoes).expect(201);
    await request(app.getHttpServer())
      .patch('/api/products/1')
      .send({ stock: 120, version: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/products/1')
      .send({ stock: 999, version: 1 })
      .expect(409);

    const { body } = await request(app.getHttpServer())
      .get('/api/products/1')
      .expect(200);

    expect(body.stock).toBe(120);
  });

  it('returns 404 when updating a product that does not exist', () => {
    return request(app.getHttpServer())
      .patch('/api/products/999')
      .send({ stock: 1, version: 1 })
      .expect(404);
  });

  it('deletes a product', async () => {
    await createProduct(runningShoes).expect(201);

    await request(app.getHttpServer()).delete('/api/products/1').expect(204);
    await request(app.getHttpServer()).get('/api/products/1').expect(404);
    await request(app.getHttpServer()).delete('/api/products/1').expect(404);
  });
});
