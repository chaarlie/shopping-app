import { cardSchema } from './cards.js';
import {
  idempotencyKeySchema,
  isFinalOrderStatus,
  orderReferenceSchema,
  placeOrderSchema,
} from './orders.js';
import { paymentEventSchema } from './payment-events.js';

const approvedCard = {
  number: '4242 4242 4242 4242',
  expMonth: 12,
  expYear: 2099,
  cvc: '123',
};

const validOrder = {
  name: ' Ada Lovelace ',
  email: ' Ada@Example.com ',
  items: [{ productId: 1, quantity: 2 }],
  card: approvedCard,
};

describe('cardSchema', () => {
  it('accepts a test card written with spaces', () => {
    expect(cardSchema.parse(approvedCard).number).toBe('4242424242424242');
  });

  it('refuses a card number that is not a test card', () => {
    const result = cardSchema.safeParse({
      ...approvedCard,
      number: '4111 1111 1111 1111',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('test cards');
  });

  it('refuses an expired card', () => {
    const result = cardSchema.safeParse({ ...approvedCard, expYear: 2001 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['expYear']);
  });

  it('requires a CVC of 3 or 4 digits', () => {
    expect(cardSchema.safeParse({ ...approvedCard, cvc: '12' }).success).toBe(
      false,
    );
  });
});

describe('placeOrderSchema', () => {
  it('trims the name and normalizes the email', () => {
    const order = placeOrderSchema.parse(validOrder);

    expect(order.name).toBe('Ada Lovelace');
    expect(order.email).toBe('ada@example.com');
  });

  it('requires at least one product', () => {
    expect(
      placeOrderSchema.safeParse({ ...validOrder, items: [] }).success,
    ).toBe(false);
  });

  it('refuses the same product twice', () => {
    expect(
      placeOrderSchema.safeParse({
        ...validOrder,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 1, quantity: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it('refuses a price sent by the browser', () => {
    expect(
      placeOrderSchema.safeParse({ ...validOrder, totalCents: 1 }).success,
    ).toBe(false);
  });
});

describe('order identifiers', () => {
  it('accepts a reference in lower case', () => {
    expect(orderReferenceSchema.parse('sr-7k3q-x9pm')).toBe('SR-7K3Q-X9PM');
  });

  it('refuses letters that Crockford base32 leaves out', () => {
    expect(orderReferenceSchema.safeParse('SR-ILOU-0000').success).toBe(false);
  });

  it('refuses a short idempotency key', () => {
    expect(idempotencyKeySchema.safeParse('abc').success).toBe(false);
  });

  it('treats paid, cancelled and refunded as final', () => {
    expect(isFinalOrderStatus('paid')).toBe(true);
    expect(isFinalOrderStatus('refund_pending')).toBe(false);
  });
});

describe('paymentEventSchema', () => {
  const data = {
    paymentId: '4b9f6c2e-3d0a-4c1b-9e8f-7a6b5c4d3e2f',
    orderReference: 'SR-7K3Q-X9PM',
    idempotencyKey: 'SR-7K3Q-X9PM:0b6f3c58-6d8e-4a4c-9d0c-1f1f2e3d4c5b',
    amountCents: 8999,
    currency: 'USD',
    cardLast4: '4242',
  };

  it('reads a failed payment with its reason', () => {
    const event = paymentEventSchema.parse({
      id: '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
      type: 'payment.failed',
      createdAt: '2026-10-23T10:00:00.000Z',
      data: {
        ...data,
        failureCode: 'card_declined',
        failureMessage: 'Your card was declined.',
      },
    });

    expect(event.type).toBe('payment.failed');
  });

  it('refuses an event type it does not know', () => {
    expect(
      paymentEventSchema.safeParse({
        id: '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
        type: 'payment.disputed',
        createdAt: '2026-10-23T10:00:00.000Z',
        data,
      }).success,
    ).toBe(false);
  });
});
