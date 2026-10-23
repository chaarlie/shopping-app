import type { Payment } from '@shop/contracts';
import {
  decideReconciliation,
  ReconcilingOrder,
} from './decide-reconciliation.js';

const now = new Date('2026-10-23T10:00:00.000Z');
const key = 'SR-7K3Q-X9PM:key-1';

const order: ReconcilingOrder = {
  status: 'pending_payment',
  dueAt: new Date('2026-10-23T10:10:00.000Z'),
  totalCents: 8999,
  attempts: [{ idempotencyKey: key, status: 'processing' }],
};
const due = { ...order, dueAt: new Date('2026-10-23T09:59:00.000Z') };

const payment = (status: Payment['status'], amountCents = 8999): Payment => ({
  id: '4b9f6c2e-3d0a-4c1b-9e8f-7a6b5c4d3e2f',
  orderReference: 'SR-7K3Q-X9PM',
  idempotencyKey: key,
  status,
  amountCents,
  currency: 'USD',
  cardBrand: 'visa',
  cardLast4: '4242',
  failureCode: status === 'failed' ? 'card_declined' : null,
  failureMessage: status === 'failed' ? 'Your card was declined.' : null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});

describe('decideReconciliation', () => {
  it('marks the order paid when a payment succeeded, even if it is due', () => {
    expect(decideReconciliation(due, [payment('succeeded')], now)).toEqual({
      kind: 'mark_paid',
      payment: payment('succeeded'),
    });
  });

  it('leaves the order alone while a payment is still processing', () => {
    expect(decideReconciliation(due, [payment('processing')], now)).toEqual({
      kind: 'leave',
    });
  });

  it('cancels a due order when nothing succeeded or is processing', () => {
    expect(decideReconciliation(due, [payment('failed')], now)).toEqual({
      kind: 'cancel',
    });
    expect(decideReconciliation(due, [], now)).toEqual({ kind: 'cancel' });
  });

  it('records a decline whose webhook never arrived', () => {
    expect(decideReconciliation(order, [payment('failed')], now)).toMatchObject(
      { kind: 'record_declines' },
    );
  });

  it('does nothing for a decline it already recorded', () => {
    const declined = {
      ...order,
      attempts: [{ idempotencyKey: key, status: 'declined' as const }],
    };

    expect(decideReconciliation(declined, [payment('failed')], now)).toEqual({
      kind: 'leave',
    });
  });

  it('flags a successful payment for a different amount', () => {
    expect(decideReconciliation(order, [payment('succeeded', 1)], now)).toEqual(
      { kind: 'flag', reason: 'amount_mismatch' },
    );
  });

  it('never touches an order that is no longer pending', () => {
    expect(decideReconciliation({ ...due, status: 'paid' }, [], now)).toEqual({
      kind: 'leave',
    });
  });
});
