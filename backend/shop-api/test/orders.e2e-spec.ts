import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { PaymentsGateway } from './../src/orders/payments/payments-gateway.js';
import { FakePaymentsGateway } from './fake-payments-gateway.js';

const card = {
  number: '4242 4242 4242 4242',
  expMonth: 12,
  expYear: 2099,
  cvc: '123',
};

const orderOf = (items: { productId: number; quantity: number }[]) => ({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  items,
  card,
});

const accessCookieOf = (response: Response): string => {
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const cookie = cookies.find((value) => value.startsWith('order_access='));

  if (!cookie) {
    throw new Error('The response did not set the order access cookie');
  }

  return cookie;
};

describe('Orders (e2e)', () => {
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

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE products, orders RESTART IDENTITY CASCADE',
    );
    payments.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  const addProduct = async (stock: number, priceCents = 8999) => {
    const { body } = await request(app.getHttpServer())
      .post('/api/products')
      .send({
        sku: 'RS-001',
        name: 'Running Shoes',
        category: 'Footwear',
        priceCents,
        stock,
      })
      .expect(201);

    return body as { id: number };
  };

  const placeOrder = (body: object, idempotencyKey: string) =>
    request(app.getHttpServer())
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(body);

  const stockOf = async (productId: number) =>
    (
      await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .expect(200)
    ).body.stock as number;

  const orderCount = async () => {
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM orders',
    );
    return Number(count);
  };

  it('takes the stock, prices the order from the database and asks payments-api to charge it', async () => {
    const shoes = await addProduct(5);

    const { body } = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 2 }]),
      'key-place-0001',
    ).expect(201);

    expect(body).toMatchObject({
      status: 'pending_payment',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      totalCents: 17998,
      currency: 'USD',
      items: [
        {
          productId: shoes.id,
          sku: 'RS-001',
          name: 'Running Shoes',
          unitPriceCents: 8999,
          quantity: 2,
          lineTotalCents: 17998,
        },
      ],
      payment: { status: 'processing', cardLast4: '4242' },
    });
    expect(body.reference).toMatch(/^SR-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(await stockOf(shoes.id)).toBe(3);
    expect(payments.requests).toEqual([
      {
        input: {
          orderReference: body.reference,
          amountCents: 17998,
          currency: 'USD',
          card: {
            number: '4242424242424242',
            expMonth: 12,
            expYear: 2099,
            cvc: '123',
          },
        },
        idempotencyKey: `${body.reference}:key-place-0001`,
      },
    ]);
  });

  it('sends the access token in an httpOnly cookie that only the order receives', async () => {
    const shoes = await addProduct(5);

    const response = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-cookie-0001',
    ).expect(201);
    const cookie = accessCookieOf(response);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain(`Path=/api/orders/${response.body.reference}`);
  });

  it('shows an order only to the browser holding its cookie', async () => {
    const shoes = await addProduct(5);
    const first = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-access-0001',
    ).expect(201);
    const second = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-access-0002',
    ).expect(201);
    const path = `/api/orders/${first.body.reference}`;

    await request(app.getHttpServer())
      .get(path)
      .set('Cookie', accessCookieOf(first).split(';')[0])
      .expect(200);
    await request(app.getHttpServer()).get(path).expect(404);
    await request(app.getHttpServer())
      .get(path)
      .set('Cookie', accessCookieOf(second).split(';')[0])
      .expect(404);
  });

  it('refuses to sell more than the stock and leaves it untouched', async () => {
    const shoes = await addProduct(5);

    const { body } = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 6 }]),
      'key-too-many-01',
    ).expect(409);

    expect(body.message).toBe('Only 5 of Running Shoes left');
    expect(await stockOf(shoes.id)).toBe(5);
    expect(await orderCount()).toBe(0);
  });

  it('sells the last unit to only one of two buyers checking out at once', async () => {
    const shoes = await addProduct(1);

    const responses = await Promise.all([
      placeOrder(
        orderOf([{ productId: shoes.id, quantity: 1 }]),
        'key-race-0001',
      ),
      placeOrder(
        orderOf([{ productId: shoes.id, quantity: 1 }]),
        'key-race-0002',
      ),
    ]);
    const statuses = responses.map((response) => response.status);

    expect(statuses.sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await stockOf(shoes.id)).toBe(0);
    expect(await orderCount()).toBe(1);
  });

  it('returns the same order when a checkout is sent twice', async () => {
    const shoes = await addProduct(5);
    const body = orderOf([{ productId: shoes.id, quantity: 2 }]);

    const first = await placeOrder(body, 'key-twice-0001').expect(201);
    const second = await placeOrder(body, 'key-twice-0001').expect(201);

    expect(second.body.reference).toBe(first.body.reference);
    expect(accessCookieOf(second).split(';')[0]).toBe(
      accessCookieOf(first).split(';')[0],
    );
    expect(await orderCount()).toBe(1);
    expect(await stockOf(shoes.id)).toBe(3);
    expect(payments.requests).toHaveLength(1);
  });

  it('refuses an Idempotency-Key that was used for a different order', async () => {
    const shoes = await addProduct(5);
    await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-reused-0001',
    ).expect(201);

    await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 2 }]),
      'key-reused-0001',
    ).expect(422);
  });

  it('refuses a product that does not exist', async () => {
    const { body } = await placeOrder(
      orderOf([{ productId: 999, quantity: 1 }]),
      'key-unknown-001',
    ).expect(400);

    expect(body.message).toBe("Product 999 doesn't exist");
  });

  it('keeps the order when payments-api does not answer, and resumes it when the checkout is sent again', async () => {
    const shoes = await addProduct(5);
    const body = orderOf([{ productId: shoes.id, quantity: 1 }]);
    payments.answer = 'unavailable';

    const first = await placeOrder(body, 'key-unknown-outcome').expect(201);

    expect(first.body.payment.status).toBe('requested');
    expect(await stockOf(shoes.id)).toBe(4);

    payments.answer = 'accept';
    const second = await placeOrder(body, 'key-unknown-outcome').expect(201);

    expect(second.body.payment.status).toBe('processing');
    expect(payments.requests.map((call) => call.idempotencyKey)).toEqual([
      `${first.body.reference}:key-unknown-outcome`,
      `${first.body.reference}:key-unknown-outcome`,
    ]);
  });

  it('lets the customer pay again with a new key after a decline', async () => {
    const shoes = await addProduct(5);
    const placed = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-declined-01',
    ).expect(201);
    const reference = placed.body.reference as string;
    await dataSource.query(
      "UPDATE payment_attempts SET status = 'declined', decline_code = 'card_declined'",
    );

    const { body } = await request(app.getHttpServer())
      .post(`/api/orders/${reference}/payments`)
      .set('Cookie', accessCookieOf(placed).split(';')[0])
      .set('Idempotency-Key', 'key-second-try-01')
      .send({ card })
      .expect(202);

    expect(body.payment).toMatchObject({
      status: 'processing',
      declineCode: null,
    });
    expect(payments.requests.at(-1)?.idempotencyKey).toBe(
      `${reference}:key-second-try-01`,
    );
    expect(await stockOf(shoes.id)).toBe(4);
  });

  it('refuses a second payment while the first is processing', async () => {
    const shoes = await addProduct(5);
    const placed = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-busy-000001',
    ).expect(201);

    const { body } = await request(app.getHttpServer())
      .post(`/api/orders/${placed.body.reference}/payments`)
      .set('Cookie', accessCookieOf(placed).split(';')[0])
      .set('Idempotency-Key', 'key-busy-000002')
      .send({ card })
      .expect(409);

    expect(body.message).toBe(
      'A payment for this order is still being processed',
    );
  });

  it('keeps the price an order was placed at when the product changes later', async () => {
    const shoes = await addProduct(5);
    const placed = await placeOrder(
      orderOf([{ productId: shoes.id, quantity: 1 }]),
      'key-snapshot-01',
    ).expect(201);
    await request(app.getHttpServer())
      .patch(`/api/products/${shoes.id}`)
      .send({ priceCents: 1, name: 'Renamed', version: 2 })
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .get(`/api/orders/${placed.body.reference}`)
      .set('Cookie', accessCookieOf(placed).split(';')[0])
      .expect(200);

    expect(body.items[0]).toMatchObject({
      name: 'Running Shoes',
      unitPriceCents: 8999,
    });
  });
});
