import { adminRequest, seedAdmin } from './admin-fixture.js';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { ClaimProductSearchChangesCommand } from './../src/products/search/commands/claim-product-search-changes.command.js';
import { CompleteProductSearchChangesCommand } from './../src/products/search/commands/complete-product-search-changes.command.js';
import { QueueAllProductsForSearchCommand } from './../src/products/search/commands/queue-all-products-for-search.command.js';

describe('Product search outbox (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let commandBus: CommandBus;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    await seedAdmin(app);
    dataSource = app.get(DataSource);
    commandBus = app.get(CommandBus);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders, product_search_outbox RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const addProduct = async (sku: string, name: string) =>
    (
      await adminRequest(app)
        .post('/api/products')
        .send({ sku, name, category: 'Footwear', priceCents: 1000, stock: 5 })
        .expect(201)
    ).body as { id: number; version: number };

  const importCsv = (row: string) =>
    adminRequest(app)
      .post('/api/products/import')
      .attach(
        'file',
        Buffer.from(
          `name,sku,description,category,price,stock,weight_kg\n${row}`,
        ),
        { filename: 'products.csv', contentType: 'text/csv' },
      )
      .expect(200);

  const queued = () =>
    dataSource.query<{ productId: number; version: number }[]>(
      'SELECT product_id AS "productId", version FROM product_search_outbox ORDER BY product_id, id',
    );

  const claim = () =>
    commandBus.execute(new ClaimProductSearchChangesCommand(10, 30_000));

  it('queues every create, edit and delete with the version the index should get', async () => {
    const shoes = await addProduct('RS-1', 'Running Shoes');
    await adminRequest(app)
      .patch(`/api/products/${shoes.id}`)
      .send({ name: 'Trail Shoes', version: shoes.version })
      .expect(200);
    await adminRequest(app).delete(`/api/products/${shoes.id}`).expect(204);

    expect(await queued()).toEqual([
      { productId: shoes.id, version: 1 },
      { productId: shoes.id, version: 2 },
      { productId: shoes.id, version: 3 },
    ]);
  });

  it('leaves stock changes out, since the index has no stock', async () => {
    const shoes = await addProduct('RS-1', 'Running Shoes');
    await adminRequest(app)
      .patch(`/api/products/${shoes.id}`)
      .send({ stock: 1, version: shoes.version })
      .expect(200);

    expect(await queued()).toEqual([{ productId: shoes.id, version: 1 }]);
  });

  it('queues the products a CSV import creates or changes, with a new version', async () => {
    await importCsv('Running Shoes,RS-1,Light shoes,Footwear,89.99,5,0.35');
    await importCsv('Trail Shoes,RS-1,Light shoes,Footwear,89.99,5,0.35');

    expect(await queued()).toEqual([
      { productId: 1, version: 1 },
      { productId: 1, version: 2 },
    ]);
  });

  it('hands a queued change to one claimer until its lease runs out', async () => {
    await addProduct('RS-1', 'Running Shoes');

    const [change] = await claim();

    expect(change).toMatchObject({ productId: 1, version: 1 });
    expect(await claim()).toEqual([]);

    await dataSource.query(
      "UPDATE product_search_outbox SET locked_until = now() - interval '1 second'",
    );

    expect(await claim()).toEqual([change]);
  });

  it('never hands one change to two claimers at once', async () => {
    await addProduct('RS-1', 'Running Shoes');

    const [first, second] = await Promise.all([claim(), claim()]);

    expect(first.length + second.length).toBe(1);
  });

  it('forgets a change once it is completed', async () => {
    await addProduct('RS-1', 'Running Shoes');
    const claimed = await claim();

    await commandBus.execute(
      new CompleteProductSearchChangesCommand(claimed.map(({ id }) => id)),
    );

    expect(await queued()).toEqual([]);
  });

  it('queues every product again for a full reindex', async () => {
    await addProduct('RS-1', 'Running Shoes');
    await addProduct('MG-1', 'Mug');
    await dataSource.query('TRUNCATE product_search_outbox');

    expect(
      await commandBus.execute(new QueueAllProductsForSearchCommand()),
    ).toBe(2);
    expect(await queued()).toEqual([
      { productId: 1, version: 1 },
      { productId: 2, version: 1 },
    ]);
  });
});
