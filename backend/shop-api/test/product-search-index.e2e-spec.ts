import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Client } from '@opensearch-project/opensearch';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { SearchUnavailableError } from './../src/common/errors.js';
import { Env } from './../src/config/env.schema.js';
import { OpenSearchProductSearchIndex } from './../src/products/search/opensearch-product-search-index.js';
import type { ProductSearchDocument } from './../src/products/search/product-search-document.js';
import { ProductSearchIndex } from './../src/products/search/product-search-index.js';

describe('Product search index (e2e)', () => {
  let app: INestApplication<App>;
  let index: ProductSearchIndex;
  let client: Client;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    index = app.get(ProductSearchIndex);
    client = app.get(Client);
  });

  beforeEach(async () => {
    const previous = await index.currentIndex();

    if (previous) {
      await index.dropIndex(previous);
    }

    await index.pointAliasAt(await index.createIndex());
  });

  afterAll(async () => {
    await app.close();
  });

  const shoes = (name: string): ProductSearchDocument => ({
    id: 1,
    sku: 'RS-1',
    name,
    description: '',
    category: 'Footwear',
    priceCents: 1000,
    createdAt: new Date().toISOString(),
  });

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

  it('creates a versioned index behind the alias', async () => {
    expect(await index.currentIndex()).toBe('products-v1');
  });

  it('writes and deletes products, keeping the version it is given', async () => {
    const written = await index.write([
      { productId: 1, version: 3, document: shoes('Running Shoes') },
    ]);

    expect(written.get(1)).toBe('done');
    expect(await stored(1)).toEqual({ name: 'Running Shoes', version: 3 });

    const deleted = await index.write([
      { productId: 1, version: 4, document: null },
    ]);

    expect(deleted.get(1)).toBe('done');
    expect(await stored(1)).toBeNull();
  });

  it('ignores an older version of a product that arrives late', async () => {
    await index.write([
      { productId: 1, version: 2, document: shoes('Trail Shoes') },
    ]);

    const late = await index.write([
      { productId: 1, version: 1, document: shoes('Running Shoes') },
    ]);

    expect(late.get(1)).toBe('done');
    expect(await stored(1)).toEqual({ name: 'Trail Shoes', version: 2 });
  });

  it('counts deleting a product the index never had as done', async () => {
    const outcomes = await index.write([
      { productId: 9, version: 1, document: null },
    ]);

    expect(outcomes.get(9)).toBe('done');
  });

  it('refuses a field the index definition does not declare', async () => {
    const outcomes = await index.write([
      {
        productId: 1,
        version: 1,
        document: { ...shoes('Mug'), colour: 'red' } as ProductSearchDocument,
      },
    ]);

    expect(outcomes.get(1)).toBe('failed');
    expect(await stored(1)).toBeNull();
  });

  it('reports an OpenSearch it cannot reach as search being unavailable', async () => {
    const unreachable = new Client({ node: 'http://127.0.0.1:9' });
    const offline = new OpenSearchProductSearchIndex(
      unreachable,
      app.get(ConfigService) as ConfigService<Env, true>,
    );

    await expect(offline.currentIndex()).rejects.toBeInstanceOf(
      SearchUnavailableError,
    );
    await unreachable.close();
  });
});
