import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import type { ProductSearchIndexerJob } from './../src/products/search/product-search-indexer.job.js';

describe('Product search while OpenSearch is down (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let indexer: ProductSearchIndexerJob;

  beforeAll(async () => {
    process.env.OPENSEARCH_URL = 'http://127.0.0.1:9';

    const { AppModule } = await import('./../src/app.module.js');
    const { setupApp } = await import('./../src/app.setup.js');
    const jobs =
      await import('./../src/products/search/product-search-indexer.job.js');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    dataSource = app.get(DataSource);
    indexer = app.get(jobs.ProductSearchIndexerJob);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders, product_search_outbox RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps product changes queued until OpenSearch is back', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .send({
        sku: 'RS-1',
        name: 'Running Shoes',
        category: 'Footwear',
        priceCents: 1000,
        stock: 5,
      })
      .expect(201);

    expect(await indexer.runOnce()).toBe(0);

    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM product_search_outbox',
    );
    expect(count).toBe('1');
  });
});
