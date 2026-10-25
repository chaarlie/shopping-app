import { adminRequest, seedAdmin } from './admin-fixture.js';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { OrderReconciliationJob } from './../src/orders/jobs/order-reconciliation.job.js';
import { PaymentsGateway } from './../src/orders/payments/payments-gateway.js';
import { FakePaymentsGateway } from './fake-payments-gateway.js';

interface PlacedOrder {
  reference: string;
  cookie: string;
}

describe('Order reconciliation (e2e)', () => {
  const payments = new FakePaymentsGateway();
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let job: OrderReconciliationJob;
  let productId: number;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsGateway)
      .useValue(payments)
      .compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    await seedAdmin(app);
    dataSource = app.get(DataSource);
    job = app.get(OrderReconciliationJob);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders RESTART IDENTITY CASCADE',
    );
    payments.reset();
    const { body } = await adminRequest(app)
      .post('/api/products')
      .send({
        sku: 'RS-001',
        name: 'Running Shoes',
        category: 'Footwear',
        priceCents: 8999,
        stock: 5,
      })
      .expect(201);
    productId = body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const placeOrder = async (): Promise<PlacedOrder> => {
    const response = await adminRequest(app)
      .post('/api/orders')
      .set('Idempotency-Key', `key-reconcile-${randomUUID()}`)
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        items: [{ productId, quantity: 2 }],
        card: {
          number: '4242 4242 4242 4242',
          expMonth: 12,
          expYear: 2099,
          cvc: '123',
        },
      })
      .expect(201);
    const cookies = response.headers['set-cookie'] as unknown as string[];

    return {
      reference: response.body.reference,
      cookie: cookies[0].split(';')[0],
    };
  };

  const orderOf = async ({ reference, cookie }: PlacedOrder) =>
    (
      await adminRequest(app)
        .get(`/api/orders/${reference}`)
        .set('Cookie', cookie)
        .expect(200)
    ).body;

  const stock = async () => {
    const [{ stock: left }] = await dataSource.query<{ stock: number }[]>(
      'SELECT stock FROM products',
    );
    return left;
  };

  const makeDue = () =>
    dataSource.query("UPDATE orders SET due_at = now() - interval '1 second'");

  const makeAttemptsOld = () =>
    dataSource.query(
      "UPDATE payment_attempts SET updated_at = now() - interval '2 minutes'",
    );

  it('cancels a due order that has no payment and returns its stock', async () => {
    payments.answer = 'unavailable';
    const order = await placeOrder();
    payments.answer = 'accept';
    await makeDue();

    await job.runOnce();

    expect((await orderOf(order)).status).toBe('cancelled');
    expect(await stock()).toBe(5);
  });

  it('marks a due order paid when payments-api says its payment succeeded', async () => {
    const order = await placeOrder();
    payments.payments[0].status = 'succeeded';
    await makeDue();

    await job.runOnce();

    expect(await orderOf(order)).toMatchObject({
      status: 'paid',
      payment: { status: 'succeeded' },
    });
    expect(await stock()).toBe(3);
  });

  it('finds a payment whose webhook was lost within a minute, before the order is due', async () => {
    const order = await placeOrder();
    payments.payments[0].status = 'succeeded';

    await job.runOnce();
    expect((await orderOf(order)).status).toBe('pending_payment');

    await makeAttemptsOld();
    await job.runOnce();

    expect((await orderOf(order)).status).toBe('paid');
  });

  it('records a decline whose webhook never arrived', async () => {
    const order = await placeOrder();
    Object.assign(payments.payments[0], {
      status: 'failed',
      failureCode: 'insufficient_funds',
      failureMessage: 'Your card has insufficient funds.',
    });
    await makeAttemptsOld();

    await job.runOnce();

    expect(await orderOf(order)).toMatchObject({
      status: 'pending_payment',
      payment: { status: 'declined', declineCode: 'insufficient_funds' },
    });
  });

  it('cancels nothing while payments-api cannot be reached', async () => {
    const order = await placeOrder();
    await makeDue();
    payments.answer = 'unavailable';

    await job.runOnce();

    expect((await orderOf(order)).status).toBe('pending_payment');
    expect(await stock()).toBe(3);
  });

  it('waits while a payment is still processing, even after the order is due', async () => {
    const order = await placeOrder();
    await makeDue();

    await job.runOnce();

    expect((await orderOf(order)).status).toBe('pending_payment');
    expect(await stock()).toBe(3);
  });

  it('refunds a late payment whose stock was sold, once', async () => {
    const order = await placeOrder();
    const [payment] = payments.payments;
    payment.status = 'succeeded';
    await dataSource.query(
      "UPDATE orders SET status = 'refund_pending', payment_id = $1",
      [payment.id],
    );

    await job.runOnce();
    await job.runOnce();

    expect((await orderOf(order)).status).toBe('refunded');
    expect(payments.refunds).toEqual([payment.id]);
  });
});
