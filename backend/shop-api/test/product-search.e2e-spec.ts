import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { ProductSearchIndex } from './../src/products/search/product-search-index.js';
import { ProductSearchIndexerJob } from './../src/products/search/product-search-indexer.job.js';
import { ProductSearchRebuilder } from './../src/products/search/product-search-rebuilder.js';

interface ProductFields {
  sku: string;
  name: string;
  category?: string;
  priceCents?: number;
  stock?: number;
  description?: string;
}

describe('Product search (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let indexer: ProductSearchIndexerJob;
  let index: ProductSearchIndex;
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
    rebuilder = app.get(ProductSearchRebuilder);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders, product_search_outbox RESTART IDENTITY CASCADE',
    );
    await rebuilder.rebuild();
    await dataSource.query('TRUNCATE product_search_outbox');
  });

  afterAll(async () => {
    await app.close();
  });

  const addProduct = async ({
    category = 'Footwear',
    priceCents = 1000,
    stock = 5,
    description = '',
    ...fields
  }: ProductFields) =>
    (
      await request(app.getHttpServer())
        .post('/api/products')
        .send({ category, priceCents, stock, description, ...fields })
        .expect(201)
    ).body as { id: number; version: number };

  const sync = async () => {
    await indexer.runOnce();
    await index.refresh();
  };

  const search = async (query: Record<string, string>) =>
    (
      await request(app.getHttpServer())
        .get('/api/products')
        .query(query)
        .expect(200)
    ).body as {
      items: { sku: string; name: string; stock: number; priceCents: number }[];
      total: number;
    };

  const skusFor = async (query: Record<string, string>) =>
    (await search(query)).items.map((item) => item.sku);

  it('puts an exact SKU match first', async () => {
    await addProduct({ sku: 'RS-0019', name: 'Running Socks' });
    await addProduct({
      sku: 'MG-1',
      name: 'Mug',
      description: 'Pairs with RS-001',
    });
    await addProduct({ sku: 'RS-001', name: 'Trail Runner' });
    await sync();

    const skus = await skusFor({ q: 'rs-001' });

    expect(skus[0]).toBe('RS-001');
  });

  it('finds products by the start of any word in the name, ignoring case and accents', async () => {
    await addProduct({ sku: 'RS-1', name: 'Running Shoes' });
    await addProduct({ sku: 'CT-1', name: 'Café Table', category: 'Home' });
    await addProduct({ sku: 'MG-1', name: 'Mug', category: 'Home' });
    await sync();

    expect(await skusFor({ q: 'RUNN' })).toEqual(['RS-1']);
    expect(await skusFor({ q: 'shoe' })).toEqual(['RS-1']);
    expect(await skusFor({ q: 'cafe' })).toEqual(['CT-1']);
  });

  it('still finds a product when a word is misspelled', async () => {
    await addProduct({ sku: 'RS-1', name: 'Running Shoes' });
    await addProduct({ sku: 'MG-1', name: 'Mug', category: 'Home' });
    await sync();

    expect(await skusFor({ q: 'runing shoes' })).toEqual(['RS-1']);
    expect(await skusFor({ q: 'runing sho' })).toEqual(['RS-1']);
  });

  it('needs every word to be found, in the name or the description', async () => {
    await addProduct({
      sku: 'WC-1',
      name: 'Wireless Charger',
      category: 'Electronics',
      description: 'Fast wireless charging pad',
    });
    await addProduct({
      sku: 'MP-1',
      name: 'Mouse Pad',
      category: 'Electronics',
      description: 'Smooth cloth surface',
    });
    await sync();

    expect(await skusFor({ q: 'charging pad' })).toEqual(['WC-1']);
    expect(await skusFor({ q: 'pad' })).toEqual(['MP-1', 'WC-1']);
    expect(await skusFor({ q: 'black wireless charging pad' })).toEqual([
      'WC-1',
    ]);
  });

  it('filters by category and sorts by price', async () => {
    await addProduct({ sku: 'RS-1', name: 'Road Shoes', priceCents: 9000 });
    await addProduct({ sku: 'RS-2', name: 'Trail Shoes', priceCents: 12000 });
    await addProduct({
      sku: 'SH-1',
      name: 'Shoe Rack',
      category: 'Home',
      priceCents: 3000,
    });
    await sync();

    expect(
      await skusFor({ q: 'shoes', category: 'Footwear', sort: 'price_desc' }),
    ).toEqual(['RS-2', 'RS-1']);
  });

  it('pages through the results and reports the total', async () => {
    for (const sku of ['A-1', 'A-2', 'A-3']) {
      await addProduct({ sku, name: `Climbing Rope ${sku}` });
    }
    await sync();

    const first = await search({ q: 'rope', pageSize: '2' });
    const second = await search({ q: 'rope', pageSize: '2', page: '2' });

    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
  });

  it('shows the current price and stock from the database, before the index catches up', async () => {
    const shoes = await addProduct({ sku: 'RS-1', name: 'Running Shoes' });
    await sync();

    await request(app.getHttpServer())
      .patch(`/api/products/${shoes.id}`)
      .send({ stock: 1, priceCents: 7500, version: shoes.version })
      .expect(200);

    expect((await search({ q: 'running' })).items[0]).toMatchObject({
      stock: 1,
      priceCents: 7500,
    });
  });

  it('treats search text as text, including SQL and markup from the CSV', async () => {
    await addProduct({
      sku: 'XS-1',
      name: "<script>alert('xss')</script>",
      category: 'Test',
    });
    await addProduct({
      sku: 'SQ-1',
      name: "Robert'); DROP TABLE products;--",
      category: 'Test',
    });
    await addProduct({ sku: 'LS-1', name: 'LED Strip Lights' });
    await sync();

    expect(await skusFor({ q: 'script' })).toEqual(['XS-1']);
    expect(await skusFor({ q: "'); DROP TABLE products;--" })).toContain(
      'SQ-1',
    );
    expect((await search({ q: '%' })).total).toBe(0);
  });
});
