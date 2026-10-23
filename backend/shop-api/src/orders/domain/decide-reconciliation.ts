import type {
  OrderStatus,
  Payment,
  PaymentAttemptStatus,
} from '@shop/contracts';

export interface ReconcilingOrder {
  status: OrderStatus;
  dueAt: Date;
  totalCents: number;
  attempts: { idempotencyKey: string; status: PaymentAttemptStatus }[];
}

export type ReconciliationDecision =
  | { kind: 'leave' }
  | { kind: 'mark_paid'; payment: Payment }
  | { kind: 'cancel' }
  | { kind: 'record_declines'; payments: Payment[] }
  | { kind: 'flag'; reason: string };

export function decideReconciliation(
  order: ReconcilingOrder,
  payments: Payment[],
  now: Date,
): ReconciliationDecision {
  if (order.status !== 'pending_payment') {
    return { kind: 'leave' };
  }

  const succeeded = payments.find(({ status }) => status === 'succeeded');

  if (succeeded) {
    return succeeded.amountCents === order.totalCents
      ? { kind: 'mark_paid', payment: succeeded }
      : { kind: 'flag', reason: 'amount_mismatch' };
  }

  if (payments.some(({ status }) => status === 'processing')) {
    return { kind: 'leave' };
  }

  if (order.dueAt.getTime() <= now.getTime()) {
    return { kind: 'cancel' };
  }

  const unrecordedDeclines = payments.filter(
    (payment) =>
      payment.status === 'failed' &&
      order.attempts.some(
        (attempt) =>
          attempt.idempotencyKey === payment.idempotencyKey &&
          attempt.status !== 'declined',
      ),
  );

  return unrecordedDeclines.length > 0
    ? { kind: 'record_declines', payments: unrecordedDeclines }
    : { kind: 'leave' };
}
