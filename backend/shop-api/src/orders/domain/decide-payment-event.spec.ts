import type { PaymentEvent } from '@shop/contracts';
import {
  decidePaymentEvent,
  PaymentEventOrder,
} from './decide-payment-event.js';

const data = {
  paymentId: '4b9f6c2e-3d0a-4c1b-9e8f-7a6b5c4d3e2f',
  orderReference: 'SR-7K3Q-X9PM',
  idempotencyKey: 'SR-7K3Q-X9PM:key-1',
  amountCents: 8999,
  currency: 'USD' as const,
  cardLast4: '4242',
};

const succeeded: PaymentEvent = {
  id: '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  type: 'payment.succeeded',
  createdAt: '2026-10-23T10:00:00.000Z',
  data,
};

const failed: PaymentEvent = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  type: 'payment.failed',
  createdAt: '2026-10-23T10:00:00.000Z',
  data: {
    ...data,
    failureCode: 'card_declined',
    failureMessage: 'Your card was declined.',
  },
};

const pending: PaymentEventOrder = {
  status: 'pending_payment',
  totalCents: 8999,
  currency: 'USD',
  paymentId: null,
  attempt: { status: 'processing' },
};

describe('decidePaymentEvent', () => {
  it.each([
    ['a success for a pending order', pending, succeeded, 'mark_paid'],
    [
      'a success for a cancelled order',
      { ...pending, status: 'cancelled' as const },
      succeeded,
      'take_stock_again',
    ],
    ['a failure for a pending order', pending, failed, 'record_decline'],
  ])('applies %s', (_case, order, event, kind) => {
    expect(decidePaymentEvent(order, event).kind).toBe(kind);
  });

  it.each([
    [
      'the same success again',
      { ...pending, status: 'paid' as const, paymentId: data.paymentId },
      succeeded,
      'already_applied',
    ],
    [
      'a failure for an order that is already paid',
      { ...pending, status: 'paid' as const },
      failed,
      'order_not_pending',
    ],
    [
      'the same decline again',
      { ...pending, attempt: { status: 'declined' as const } },
      failed,
      'already_applied',
    ],
  ])('ignores %s', (_case, order, event, reason) => {
    expect(decidePaymentEvent(order, event)).toEqual({
      kind: 'ignore',
      reason,
    });
  });

  it.each([
    ['an order it does not know', null, succeeded, 'unknown_order'],
    [
      'an amount that does not match the order',
      { ...pending, totalCents: 1 },
      succeeded,
      'amount_mismatch',
    ],
    [
      'a second payment for an order that is already paid',
      { ...pending, status: 'paid' as const, paymentId: 'another-payment' },
      succeeded,
      'second_payment',
    ],
    [
      'a failure for an attempt it never made',
      { ...pending, attempt: null },
      failed,
      'unknown_attempt',
    ],
  ])('flags %s for a person to check', (_case, order, event, reason) => {
    expect(decidePaymentEvent(order, event)).toEqual({ kind: 'flag', reason });
  });
});
