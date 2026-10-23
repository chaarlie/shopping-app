import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { paymentEventSchema } from '@shop/contracts';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { PaymentSettlementWorker } from './../src/payments/workers/payment-settlement.worker.js';

const apiKey = process.env.PAYMENTS_API_KEY ?? '';

const payment = (number: string, orderReference = 'SR-7K3Q-X9PM') => ({
  orderReference,
  amountCents: 8999,
  currency: 'USD',
  card: { number, expMonth: 12, expYear: 2099, cvc: '123' },
});

const approved = '4242 4242 4242 4242';
const declined = '4000 0000 0000 0002';

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let settlement: PaymentSettlementWorker;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    settlement = app.get(PaymentSettlementWorker);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE payments, outbox_events');
  });

  afterAll(async () => {
    await app.close();
  });

  const createPayment = (body: object, key: string) =>
    request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', key)
      .send(body);

  const outboxEvents = () =>
    dataSource.query<{ type: string; payload: unknown }[]>(
      'SELECT type, payload FROM outbox_events ORDER BY created_at',
    );

  it('accepts a payment and keeps it processing until it settles', async () => {
    const { body } = await createPayment(
      payment(approved),
      'key-approved-1',
    ).expect(202);

    expect(body).toMatchObject({
      orderReference: 'SR-7K3Q-X9PM',
      status: 'processing',
      amountCents: 8999,
      cardBrand: 'visa',
      cardLast4: '4242',
      failureCode: null,
    });
    expect(await outboxEvents()).toEqual([]);
  });

  it('requires the service key', () => {
    return request(app.getHttpServer())
      .post('/payments')
      .set('Idempotency-Key', 'key-without-auth')
      .send(payment(approved))
      .expect(401);
  });

  it('requires an Idempotency-Key', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .send(payment(approved))
      .expect(400);

    expect(body.message).toBe('Send an Idempotency-Key header');
  });

  it('refuses a card that is not a test card', () => {
    return createPayment(
      payment('4111 1111 1111 1111'),
      'key-real-card',
    ).expect(400);
  });

  it('returns the first payment when a request is repeated', async () => {
    const first = await createPayment(payment(approved), 'key-repeated').expect(
      202,
    );
    const second = await createPayment(
      payment(approved),
      'key-repeated',
    ).expect(202);

    expect(second.body.id).toBe(first.body.id);
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM payments',
    );
    expect(count).toBe('1');
  });

  it('refuses a key that was used for a different request', async () => {
    await createPayment(payment(approved), 'key-reused').expect(202);

    const { body } = await createPayment(
      { ...payment(approved), amountCents: 1 },
      'key-reused',
    ).expect(422);

    expect(body.message).toContain('different payment request');
  });

  it('allows only one active payment per order, whatever the keys', async () => {
    const responses = await Promise.all([
      createPayment(payment(approved), 'key-race-a'),
      createPayment(payment(approved), 'key-race-b'),
    ]);

    const statuses = responses.map((response) => response.status);

    expect(statuses.sort((a, b) => a - b)).toEqual([202, 409]);
  });

  it('settles an approved card and writes a payment.succeeded event', async () => {
    const { body } = await createPayment(
      payment(approved),
      'key-settle-ok',
    ).expect(202);

    expect(await settlement.runOnce()).toBe(1);

    const [event] = await outboxEvents();
    const parsed = paymentEventSchema.parse(event.payload);
    expect(parsed).toMatchObject({
      type: 'payment.succeeded',
      data: {
        paymentId: body.id,
        orderReference: 'SR-7K3Q-X9PM',
        idempotencyKey: 'key-settle-ok',
        amountCents: 8999,
        cardLast4: '4242',
      },
    });
    expect(await settlement.runOnce()).toBe(0);
  });

  it('settles a declined card with its reason and allows another attempt', async () => {
    await createPayment(payment(declined), 'key-declined').expect(202);
    await settlement.runOnce();

    const [event] = await outboxEvents();
    expect(event.payload).toMatchObject({
      type: 'payment.failed',
      data: {
        failureCode: 'card_declined',
        failureMessage: 'Your card was declined.',
      },
    });

    await createPayment(payment(approved), 'key-after-decline').expect(202);
  });

  it('lists the payments of an order', async () => {
    await createPayment(payment(declined), 'key-list-1').expect(202);
    await settlement.runOnce();
    await createPayment(payment(approved), 'key-list-2').expect(202);
    await createPayment(payment(approved, 'SR-0THR-0RDR'), 'key-list-3').expect(
      202,
    );

    const { body } = await request(app.getHttpServer())
      .get('/payments?orderReference=SR-7K3Q-X9PM')
      .set('Authorization', `Bearer ${apiKey}`)
      .expect(200);

    expect(body.items.map((item: { status: string }) => item.status)).toEqual([
      'failed',
      'processing',
    ]);
  });

  it('refunds a succeeded payment once, however often it is asked', async () => {
    const { body } = await createPayment(
      payment(approved),
      'key-refund',
    ).expect(202);
    await settlement.runOnce();

    const refund = () =>
      request(app.getHttpServer())
        .post(`/payments/${body.id}/refunds`)
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Idempotency-Key', `refund:${body.id}`);

    const first = await refund().expect(200);
    const second = await refund().expect(200);

    expect(first.body.status).toBe('refunded');
    expect(second.body.updatedAt).toBe(first.body.updatedAt);
  });

  it('refuses to refund a payment that did not succeed', async () => {
    const { body } = await createPayment(
      payment(declined),
      'key-no-refund',
    ).expect(202);
    await settlement.runOnce();

    await request(app.getHttpServer())
      .post(`/payments/${body.id}/refunds`)
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', `refund:${body.id}`)
      .expect(409);
  });
});
