import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PaymentEvent } from '@shop/contracts';
import { signPayload } from '@shop/webhook-signature';
import { randomUUID } from 'node:crypto';
import request, { Response } from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { PaymentsGateway } from './../src/orders/payments/payments-gateway.js';
import { FakePaymentsGateway } from './fake-payments-gateway.js';

const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? '';

const card = {
  number: '4242 4242 4242 4242',
  expMonth: 12,
  expYear: 2099,
  cvc: '123',
};

interface PlacedOrder {
  reference: string;
  totalCents: number;
  cookie: string;
}

describe('Payment webhooks (e2e)', () => {
  const payments = new FakePaymentsGateway();
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsGateway)
      .useValue(payments)
      .compile();

    app = setupApp(moduleFixture.createNestApplication({ rawBody: true }));
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders, processed_payment_events RESTART IDENTITY CASCADE',
    );
    payments.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  const placeOrder = async (stock = 5): Promise<PlacedOrder> => {
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .send({
        sku: 'RS-001',
        name: 'Running Shoes',
        category: 'Footwear',
        priceCents: 8999,
        stock,
      })
      .expect(201);
    const response: Response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Idempotency-Key', 'key-webhook-order')
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        items: [{ productId: product.body.id, quantity: 1 }],
        card,
      })
      .expect(201);
    const cookies = response.headers['set-cookie'] as unknown as string[];

    return {
      reference: response.body.reference,
      totalCents: response.body.totalCents,
      cookie: cookies[0].split(';')[0],
    };
  };

  const succeededFor = (order: PlacedOrder): PaymentEvent => ({
    id: randomUUID(),
    type: 'payment.succeeded',
    createdAt: new Date().toISOString(),
    data: {
      paymentId: payments.payments[0].id,
      orderReference: order.reference,
      idempotencyKey: `${order.reference}:key-webhook-order`,
      amountCents: order.totalCents,
      currency: 'USD',
      cardLast4: '4242',
    },
  });

  const failedFor = (order: PlacedOrder): PaymentEvent => ({
    ...succeededFor(order),
    type: 'payment.failed',
    data: {
      ...succeededFor(order).data,
      failureCode: 'card_declined',
      failureMessage: 'Your card was declined.',
    },
  });

  const deliver = (
    event: object,
    { signWith = secret, timestamp = Math.floor(Date.now() / 1000) } = {},
  ) => {
    const body = JSON.stringify(event);

    return request(app.getHttpServer())
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set(signPayload(body, signWith, JSON.parse(body).id, timestamp))
      .send(body);
  };

  const orderOf = async ({ reference, cookie }: PlacedOrder) =>
    (
      await request(app.getHttpServer())
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

  it('lives outside /api, where nginx never forwards it', async () => {
    const order = await placeOrder();
    const body = JSON.stringify(succeededFor(order));

    await request(app.getHttpServer())
      .post('/api/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set(signPayload(body, secret, JSON.parse(body).id))
      .send(body)
      .expect(404);
  });

  it('refuses an event that is unsigned, signed with another secret, old or changed', async () => {
    const order = await placeOrder();
    const event = succeededFor(order);
    const body = JSON.stringify(event);

    await request(app.getHttpServer())
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);
    await deliver(event, {
      signWith: `whsec_${Buffer.alloc(32, 8).toString('base64')}`,
    }).expect(401);
    await deliver(event, {
      timestamp: Math.floor(Date.now() / 1000) - 301,
    }).expect(401);
    await request(app.getHttpServer())
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set(signPayload(body, secret, JSON.parse(body).id))
      .send(
        body.replace(`"amountCents":${order.totalCents}`, '"amountCents":1'),
      )
      .expect(401);

    expect((await orderOf(order)).status).toBe('pending_payment');
  });

  it('rejects a signed header ID that disagrees with the event ID', async () => {
    const order = await placeOrder();
    const body = JSON.stringify(succeededFor(order));

    await request(app.getHttpServer())
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set(signPayload(body, secret, randomUUID()))
      .send(body)
      .expect(400);

    expect((await orderOf(order)).status).toBe('pending_payment');
    expect(
      await dataSource.query('SELECT * FROM processed_payment_events'),
    ).toEqual([]);
  });

  it('marks the order paid when its payment succeeds', async () => {
    const order = await placeOrder();

    const { body } = await deliver(succeededFor(order)).expect(200);

    expect(body).toEqual({ received: true, outcome: 'applied' });
    expect(await orderOf(order)).toMatchObject({
      status: 'paid',
      payment: { status: 'succeeded', cardLast4: '4242' },
    });
  });

  it('applies an event once, however often it is delivered', async () => {
    const order = await placeOrder();
    const event = succeededFor(order);

    await deliver(event).expect(200);
    const { version } = await orderOf(order);
    const { body } = await deliver(event).expect(200);

    expect(body.outcome).toBe('repeat');
    expect((await orderOf(order)).version).toBe(version);
  });

  it('records a decline and keeps the order open for another attempt', async () => {
    const order = await placeOrder();

    await deliver(failedFor(order)).expect(200);

    expect(await orderOf(order)).toMatchObject({
      status: 'pending_payment',
      payment: {
        status: 'declined',
        declineCode: 'card_declined',
        declineMessage: 'Your card was declined.',
      },
    });
    expect(await stock()).toBe(4);
  });

  it('flags a payment whose amount does not match the order, and changes nothing', async () => {
    const order = await placeOrder();
    const event = succeededFor(order);
    event.data.amountCents = 1;

    const { body } = await deliver(event).expect(200);

    expect(body.outcome).toBe('flagged');
    expect((await orderOf(order)).status).toBe('pending_payment');
    const [row] = await dataSource.query<{ outcome: string; detail: string }[]>(
      'SELECT outcome, detail FROM processed_payment_events',
    );
    expect(row).toEqual({ outcome: 'flagged', detail: 'amount_mismatch' });
  });

  it('flags an event for an order it does not know', async () => {
    const order = await placeOrder();
    const event = succeededFor(order);
    event.data.orderReference = 'SR-0000-0000';

    const { body } = await deliver(event).expect(200);

    expect(body.outcome).toBe('flagged');
  });

  it('takes the stock again for a payment that arrives after its order was cancelled', async () => {
    const order = await placeOrder();
    await dataSource.query(
      "UPDATE orders SET status = 'cancelled'; UPDATE products SET stock = stock + 1",
    );

    await deliver(succeededFor(order)).expect(200);

    expect((await orderOf(order)).status).toBe('paid');
    expect(await stock()).toBe(4);
  });

  it('marks a late payment for a refund when its stock was sold meanwhile', async () => {
    const order = await placeOrder(1);
    await dataSource.query("UPDATE orders SET status = 'cancelled'");

    await deliver(succeededFor(order)).expect(200);

    expect((await orderOf(order)).status).toBe('refund_pending');
    expect(await stock()).toBe(0);
  });

  it('answers 400 for a signed event it cannot read', async () => {
    await deliver({ id: 'not-an-event' }).expect(400);
  });
});
