import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { signPayload } from '@shop/webhook-signature';
import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { PaymentsGateway } from './../src/orders/payments/payments-gateway.js';
import { FakePaymentsGateway } from './fake-payments-gateway.js';

const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? '';

interface PlacedOrder {
  reference: string;
  totalCents: number;
  cookie: string;
  key: string;
}

interface StreamEvent {
  event: string;
  data: string;
}

class EventReader {
  private buffer = '';
  private readonly decoder = new TextDecoder();

  constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
  ) {}

  async next(): Promise<StreamEvent | null> {
    for (;;) {
      const end = this.buffer.indexOf('\n\n');

      if (end >= 0) {
        const block = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 2);
        const event = parse(block);

        if (event.event !== 'heartbeat') {
          return event;
        }

        continue;
      }

      const { done, value } = await this.reader.read();

      if (done) {
        return null;
      }

      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  async nextOrder(): Promise<{
    reference: string;
    status: string;
    payment: { status: string };
  }> {
    const event = await this.next();

    if (!event || event.event !== 'order') {
      throw new Error(`Expected an order event, got ${JSON.stringify(event)}`);
    }

    return JSON.parse(event.data);
  }
}

function parse(block: string): StreamEvent {
  const fields = { event: 'message', data: '' };

  for (const line of block.split('\n')) {
    const separator = line.indexOf(': ');
    const name = line.slice(0, separator);
    const value = line.slice(separator + 2);

    if (name === 'event') {
      fields.event = value;
    }

    if (name === 'data') {
      fields.data += value;
    }
  }

  return fields;
}

describe('Order events over SSE (e2e)', () => {
  const payments = new FakePaymentsGateway();
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let baseUrl: string;
  let productId: number;
  const openReaders: ReadableStreamDefaultReader<Uint8Array>[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsGateway)
      .useValue(payments)
      .compile();

    app = setupApp(moduleFixture.createNestApplication({ rawBody: true }));
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as unknown as Server;
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders, processed_payment_events RESTART IDENTITY CASCADE',
    );
    payments.reset();
    const { body } = await request(app.getHttpServer())
      .post('/api/products')
      .send({
        sku: 'RS-001',
        name: 'Running Shoes',
        category: 'Footwear',
        priceCents: 8999,
        stock: 10,
      })
      .expect(201);
    productId = body.id;
  });

  afterEach(async () => {
    await Promise.all(openReaders.splice(0).map((reader) => reader.cancel()));
  });

  afterAll(async () => {
    await app.close();
  });

  const placeOrder = async (): Promise<PlacedOrder> => {
    const key = `key-events-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        items: [{ productId, quantity: 1 }],
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
      totalCents: response.body.totalCents,
      cookie: cookies[0].split(';')[0],
      key,
    };
  };

  const openStream = async (order: PlacedOrder) => {
    const response = await fetch(
      `${baseUrl}/api/orders/${order.reference}/events`,
      { headers: { cookie: order.cookie } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    const reader = response.body!.getReader();
    openReaders.push(reader);

    return new EventReader(reader);
  };

  const deliver = (
    order: PlacedOrder,
    type: 'payment.succeeded' | 'payment.failed',
  ) => {
    const payment = payments.payments.find(
      ({ orderReference }) => orderReference === order.reference,
    );
    const data = {
      paymentId: payment?.id ?? randomUUID(),
      orderReference: order.reference,
      idempotencyKey: `${order.reference}:${order.key}`,
      amountCents: order.totalCents,
      currency: 'USD',
      cardLast4: '4242',
    };
    const body = JSON.stringify({
      id: randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      data:
        type === 'payment.failed'
          ? {
              ...data,
              failureCode: 'card_declined',
              failureMessage: 'Your card was declined.',
            }
          : data,
    });

    return request(app.getHttpServer())
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('X-Signature', signPayload(body, secret))
      .send(body)
      .expect(200);
  };

  it('sends the current status first, then each change, and ends once the order is paid', async () => {
    const order = await placeOrder();
    const events = await openStream(order);

    expect(await events.nextOrder()).toMatchObject({
      reference: order.reference,
      status: 'pending_payment',
      payment: { status: 'processing' },
    });

    await deliver(order, 'payment.succeeded');

    expect(await events.nextOrder()).toMatchObject({
      status: 'paid',
      payment: { status: 'succeeded' },
    });
    expect(await events.next()).toBeNull();
  });

  it('tells a stream only about its own order', async () => {
    const mine = await placeOrder();
    const other = await placeOrder();
    const events = await openStream(mine);
    await events.nextOrder();

    await deliver(other, 'payment.failed');
    await deliver(mine, 'payment.failed');

    expect(await events.nextOrder()).toMatchObject({
      reference: mine.reference,
      status: 'pending_payment',
      payment: { status: 'declined' },
    });
  });

  it('passes on a change committed by another shop-api instance', async () => {
    const order = await placeOrder();
    const events = await openStream(order);
    await events.nextOrder();

    await dataSource.transaction(async (manager) => {
      await manager.query(
        "UPDATE orders SET status = 'paid', version = version + 1 WHERE reference = $1",
        [order.reference],
      );
      await manager.query("SELECT pg_notify('order_updates', $1)", [
        order.reference,
      ]);
    });

    expect((await events.nextOrder()).status).toBe('paid');
  });

  it('refuses a stream without the order cookie', async () => {
    const order = await placeOrder();

    const response = await fetch(
      `${baseUrl}/api/orders/${order.reference}/events`,
    );

    expect(response.status).toBe(404);
  });
});
