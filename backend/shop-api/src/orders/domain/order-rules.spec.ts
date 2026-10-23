import { isOrderAccessToken, orderAccessToken } from './order-access-token.js';
import { orderReferenceFrom } from './order-reference.js';
import { paymentRetryProblem } from './payment-rules.js';
import { priceCart } from './price-cart.js';

const shoes = {
  id: 1,
  sku: 'RS-001',
  name: 'Running Shoes',
  priceCents: 8999,
  stock: 3,
};
const mug = { id: 2, sku: 'MG-1', name: 'Mug', priceCents: 1250, stock: 0 };

describe('orderReferenceFrom', () => {
  it('writes 8 random bytes as Crockford base32', () => {
    expect(
      orderReferenceFrom(new Uint8Array([0, 1, 2, 31, 32, 33, 255, 18])),
    ).toBe('SR-012Z-01ZJ');
  });

  it('needs at least 8 bytes', () => {
    expect(() => orderReferenceFrom(new Uint8Array(4))).toThrow(RangeError);
  });
});

describe('orderAccessToken', () => {
  const secret = 's'.repeat(32);

  it('accepts the token made for the same reference', () => {
    const token = orderAccessToken('SR-7K3Q-X9PM', secret);

    expect(isOrderAccessToken(token, 'SR-7K3Q-X9PM', secret)).toBe(true);
  });

  it('refuses a token made for another order or with another secret', () => {
    const token = orderAccessToken('SR-7K3Q-X9PM', secret);

    expect(isOrderAccessToken(token, 'SR-0000-0000', secret)).toBe(false);
    expect(isOrderAccessToken(token, 'SR-7K3Q-X9PM', 't'.repeat(32))).toBe(
      false,
    );
    expect(isOrderAccessToken('short', 'SR-7K3Q-X9PM', secret)).toBe(false);
  });
});

describe('priceCart', () => {
  it('prices each line from the product, not from the request', () => {
    expect(priceCart([{ productId: 1, quantity: 2 }], [shoes])).toEqual({
      ok: true,
      totalCents: 17998,
      lines: [
        {
          productId: 1,
          sku: 'RS-001',
          name: 'Running Shoes',
          unitPriceCents: 8999,
          quantity: 2,
        },
      ],
    });
  });

  it('says how many are left when there is not enough stock', () => {
    expect(priceCart([{ productId: 1, quantity: 4 }], [shoes])).toMatchObject({
      ok: false,
      problem: 'out_of_stock',
      message: 'Only 3 of Running Shoes left',
    });
  });

  it('says a product is out of stock when none are left', () => {
    expect(priceCart([{ productId: 2, quantity: 1 }], [mug])).toMatchObject({
      message: 'Mug is out of stock',
    });
  });

  it('refuses a product that does not exist', () => {
    expect(priceCart([{ productId: 9, quantity: 1 }], [shoes])).toMatchObject({
      ok: false,
      problem: 'unknown_product',
    });
  });

  it('refuses a total a card payment cannot take', () => {
    const yacht = { ...shoes, priceCents: 99_999_999, stock: 10 };

    expect(priceCart([{ productId: 1, quantity: 2 }], [yacht])).toMatchObject({
      ok: false,
      problem: 'too_expensive',
    });
  });
});

describe('paymentRetryProblem', () => {
  const now = new Date('2026-10-23T10:00:00.000Z');
  const pending = {
    status: 'pending_payment' as const,
    dueAt: new Date('2026-10-23T10:10:00.000Z'),
  };
  const attempt = (
    status: 'requested' | 'processing' | 'succeeded' | 'declined',
    secondsAgo = 120,
  ) => ({ status, updatedAt: new Date(now.getTime() - secondsAgo * 1000) });

  it('allows a new attempt after a decline', () => {
    expect(
      paymentRetryProblem(
        { ...pending, latestAttempt: attempt('declined') },
        now,
      ),
    ).toBeNull();
  });

  it('refuses while a payment is processing', () => {
    expect(
      paymentRetryProblem(
        { ...pending, latestAttempt: attempt('processing') },
        now,
      ),
    ).toBe('A payment for this order is still being processed');
  });

  it('waits a minute for an attempt payments-api has not answered yet', () => {
    expect(
      paymentRetryProblem(
        { ...pending, latestAttempt: attempt('requested', 10) },
        now,
      ),
    ).not.toBeNull();
    expect(
      paymentRetryProblem(
        { ...pending, latestAttempt: attempt('requested', 61) },
        now,
      ),
    ).toBeNull();
  });

  it('refuses an order that is due or no longer pending', () => {
    expect(
      paymentRetryProblem(
        { ...pending, dueAt: now, latestAttempt: attempt('declined') },
        now,
      ),
    ).toBe('This order expired before it was paid. Place a new order.');
    expect(
      paymentRetryProblem(
        { ...pending, status: 'paid', latestAttempt: attempt('succeeded') },
        now,
      ),
    ).toBe('This order is already paid');
  });
});
