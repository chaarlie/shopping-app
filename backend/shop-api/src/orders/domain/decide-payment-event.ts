import type {
  Currency,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentEvent,
} from '@shop/contracts';

export interface PaymentEventOrder {
  status: OrderStatus;
  totalCents: number;
  currency: Currency;
  paymentId: string | null;
  attempt: { status: PaymentAttemptStatus } | null;
}

export type PaymentEventDecision =
  | { kind: 'mark_paid' }
  | { kind: 'record_decline' }
  | { kind: 'take_stock_again' }
  | { kind: 'ignore'; reason: string }
  | { kind: 'flag'; reason: string };

export function decidePaymentEvent(
  order: PaymentEventOrder | null,
  event: PaymentEvent,
): PaymentEventDecision {
  if (!order) {
    return { kind: 'flag', reason: 'unknown_order' };
  }

  if (
    event.data.amountCents !== order.totalCents ||
    event.data.currency !== order.currency
  ) {
    return { kind: 'flag', reason: 'amount_mismatch' };
  }

  if (event.type === 'payment.succeeded') {
    if (order.status === 'pending_payment') {
      return { kind: 'mark_paid' };
    }

    if (order.status === 'cancelled') {
      return { kind: 'take_stock_again' };
    }

    return order.paymentId === event.data.paymentId
      ? { kind: 'ignore', reason: 'already_applied' }
      : { kind: 'flag', reason: 'second_payment' };
  }

  if (order.status !== 'pending_payment') {
    return { kind: 'ignore', reason: 'order_not_pending' };
  }

  if (!order.attempt) {
    return { kind: 'flag', reason: 'unknown_attempt' };
  }

  return order.attempt.status === 'declined'
    ? { kind: 'ignore', reason: 'already_applied' }
    : { kind: 'record_decline' };
}
