import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { paymentEventSchema } from '@shop/contracts';
import { verifySignature } from '@shop/webhook-signature';
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import type { PaymentSettlementWorker } from './../src/payments/workers/payment-settlement.worker.js';
import type { WebhookSenderWorker } from './../src/webhooks/workers/webhook-sender.worker.js';

interface ReceivedWebhook {
  headers: IncomingHttpHeaders;
  body: string;
}

const apiKey = process.env.PAYMENTS_API_KEY ?? '';
const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? '';

describe('Webhook sender (e2e)', () => {
  let receiver: Server;
  let received: ReceivedWebhook[];
  let answer: number;
  let answerWhen: Promise<void>;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let settlement: PaymentSettlementWorker;
  let sender: WebhookSenderWorker;

  beforeAll(async () => {
    receiver = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received.push({
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
        void answerWhen.then(() => {
          res.statusCode = answer;
          res.end();
        });
      });
    });
    await new Promise<void>((resolve) =>
      receiver.listen(0, '127.0.0.1', resolve),
    );
    const { port } = receiver.address() as AddressInfo;
    process.env.PAYMENT_WEBHOOK_URL = `http://127.0.0.1:${port}/webhooks/payments`;

    const { AppModule } = await import('./../src/app.module.js');
    const workers =
      await import('./../src/payments/workers/payment-settlement.worker.js');
    const senders =
      await import('./../src/webhooks/workers/webhook-sender.worker.js');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    settlement = app.get(workers.PaymentSettlementWorker);
    sender = app.get(senders.WebhookSenderWorker);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE payments, outbox_events, webhook_deliveries',
    );
    received = [];
    answer = 200;
    answerWhen = Promise.resolve();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => receiver.close(resolve));
  });

  const settledPayment = async (key: string) => {
    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', key)
      .send({
        orderReference: 'SR-7K3Q-X9PM',
        amountCents: 8999,
        currency: 'USD',
        card: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2099,
          cvc: '123',
        },
      })
      .expect(202);
    await settlement.runOnce();
  };

  const outboxRow = async () => {
    const [row] = await dataSource.query<
      {
        id: string;
        attempts: number;
        delivered_at: Date | null;
        dead_at: Date | null;
        next_attempt_at: Date;
        last_error: string | null;
      }[]
    >('SELECT * FROM outbox_events');
    return row;
  };

  const deliveryStatuses = async () =>
    (
      await dataSource.query<{ status_code: number | null }[]>(
        'SELECT status_code FROM webhook_deliveries ORDER BY attempt',
      )
    ).map((row) => row.status_code);

  const makeDue = () =>
    dataSource.query('UPDATE outbox_events SET next_attempt_at = now()');

  it('posts a settled payment as a signed webhook and marks it delivered', async () => {
    await settledPayment('key-webhook-ok');

    expect(await sender.runOnce()).toBe(1);

    expect(received).toHaveLength(1);
    const [{ headers, body }] = received;
    expect(
      verifySignature(body, headers['x-signature'] as string, secret),
    ).toEqual({ valid: true });
    const event = paymentEventSchema.parse(JSON.parse(body));
    expect(event.type).toBe('payment.succeeded');
    expect(headers['x-event-id']).toBe(event.id);

    const row = await outboxRow();
    expect(row.attempts).toBe(1);
    expect(row.delivered_at).not.toBeNull();
    expect(await deliveryStatuses()).toEqual([200]);
    expect(await sender.runOnce()).toBe(0);
  });

  it('retries a failed delivery 5 seconds later', async () => {
    await settledPayment('key-webhook-retry');
    answer = 503;

    await sender.runOnce();

    const failed = await outboxRow();
    expect(failed.attempts).toBe(1);
    expect(failed.delivered_at).toBeNull();
    expect(failed.last_error).toBe('the receiver answered 503');
    expect(failed.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + 3000);
    expect(await sender.runOnce()).toBe(0);

    answer = 200;
    await makeDue();
    await sender.runOnce();

    expect(received).toHaveLength(2);
    expect((await outboxRow()).delivered_at).not.toBeNull();
    expect(await deliveryStatuses()).toEqual([503, 200]);
  });

  it('marks an event dead after three failed attempts', async () => {
    await settledPayment('key-webhook-dead');
    answer = 500;

    for (let attempt = 0; attempt < 3; attempt++) {
      await sender.runOnce();
      await makeDue();
    }

    const row = await outboxRow();
    expect(row.attempts).toBe(3);
    expect(row.dead_at).not.toBeNull();
    expect(await sender.runOnce()).toBe(0);
    expect(received).toHaveLength(3);
  });

  it('never sends the same event from two senders at once', async () => {
    await settledPayment('key-webhook-race');

    const claimed = await Promise.all([sender.runOnce(), sender.runOnce()]);

    expect(claimed.sort((a, b) => a - b)).toEqual([0, 1]);
    expect(received).toHaveLength(1);
  });

  it('does not send an event again while its first attempt waits for an answer', async () => {
    await settledPayment('key-webhook-lease');
    let answerNow = () => {};
    answerWhen = new Promise((resolve) => {
      answerNow = resolve;
    });

    const first = sender.runOnce();
    await vi.waitFor(() => expect(received).toHaveLength(1));

    expect(await sender.runOnce()).toBe(0);

    answerNow();
    expect(await first).toBe(1);
    expect(received).toHaveLength(1);
  });
});
