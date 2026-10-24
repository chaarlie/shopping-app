import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@opensearch-project/opensearch';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import type { ProductSearchDocument } from './../src/products/search/product-search-document.js';
import { ProductSearchIndex } from './../src/products/search/product-search-index.js';
import { ProductSearchIndexerJob } from './../src/products/search/product-search-indexer.job.js';
import { ProductSearchRebuilder } from './../src/products/search/product-search-rebuilder.js';

describe('Product search index sync (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let indexer: ProductSearchIndexerJob;
  let index: ProductSearchIndex;
  let client: Client;
  let rebuilder: ProductSearchRebuilder;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    dataSource = app.get(DataSource);
    indexer = app.get(ProductSearchIndexerJob);
    index = app.get(ProductSearchIndex);
    client = app.get(Client);
    rebuilder = app.get(ProductSearchRebuilder);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders, product_search_outbox RESTART IDENTITY CASCADE',
    );
    const previous = await index.pointAliasAt(
      await index.createIndex(String(Date.now())),
    );

    if (previous) {
      await index.dropIndex(previous);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const addProduct = async (sku: string, name: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/products')
        .send({ sku, name, category: 'Footwear', priceCents: 1000, stock: 5 })
        .expect(201)
    ).body as { id: number; version: number };

  const stored = async (id: number) => {
    const { body } = await client.get(
      { index: 'products', id: String(id) },
      { ignore: [404] },
    );

    return body.found
      ? {
          name: (body._source as ProductSearchDocument).name,
          version: body._version,
        }
      : null;
  };

  const queuedCount = async () =>
    Number(
      (
        await dataSource.query<{ count: string }[]>(
          'SELECT count(*) FROM product_search_outbox',
        )
      )[0].count,
    );

  it('indexes new products at their current version', async () => {
    const shoes = await addProduct('RS-1', 'Running Shoes');

    expect(await indexer.runOnce()).toBe(1);
    expect(await stored(shoes.id)).toEqual({
      name: 'Running Shoes',
      version: 1,
    });
    expect(await queuedCount()).toBe(0);
  });

  it('follows renames and deletions', async () => {
    const shoes = await addProduct('RS-1', 'Running Shoes');
    const mug = await addProduct('MG-1', 'Mug');
    await indexer.runOnce();

    await request(app.getHttpServer())
      .patch(`/api/products/${shoes.id}`)
      .send({ name: 'Trail Shoes', version: shoes.version })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/products/${mug.id}`)
      .expect(204);
    await indexer.runOnce();

    expect(await stored(shoes.id)).toEqual({
      name: 'Trail Shoes',
      version: 2,
    });
    expect(await stored(mug.id)).toBeNull();
  });

  it('follows products renamed by a CSV import', async () => {
    const importCsv = (row: string) =>
      request(app.getHttpServer())
        .post('/api/products/import')
        .attach(
          'file',
          Buffer.from(
            `name,sku,description,category,price,stock,weight_kg\n${row}`,
          ),
          { filename: 'products.csv', contentType: 'text/csv' },
        )
        .expect(200);

    await importCsv('Running Shoes,RS-1,Light shoes,Footwear,89.99,5,0.35');
    await indexer.runOnce();
    await importCsv('Trail Shoes,RS-1,Light shoes,Footwear,89.99,5,0.35');
    await indexer.runOnce();

    expect(await stored(1)).toEqual({ name: 'Trail Shoes', version: 2 });
  });

  it('recreates a missing index, keeping the changes it could not send', async () => {
    const shoes = await addProduct('RS-1', 'Running Shoes');
    await indexer.runOnce();
    await index.dropIndex((await index.currentIndex()) as string);
    const mug = await addProduct('MG-1', 'Mug');

    expect(await indexer.runOnce()).toBe(0);
    expect(await queuedCount()).toBe(1);

    await indexer.runOnce();

    expect(await index.currentIndex()).toBe('products-v1');
    expect(await stored(shoes.id)).toMatchObject({ name: 'Running Shoes' });
    expect(await stored(mug.id)).toMatchObject({ name: 'Mug' });
  });

  it('rebuilds the index from the database into a new index', async () => {
    const shoes = await addProduct('RS-1', 'Running Shoes');
    const before = await index.currentIndex();

    const rebuilt = await rebuilder.rebuild();

    expect(rebuilt).toMatchObject({ products: 1, replaced: before });
    expect(await index.currentIndex()).toBe(rebuilt.index);
    expect(await stored(shoes.id)).toEqual({
      name: 'Running Shoes',
      version: 1,
    });
    expect(
      (await client.indices.exists({ index: before as string })).body,
    ).toBe(false);
  });
});
