import type { OrderStatus, PaymentAttemptStatus } from '@shop/contracts';

export const paymentWindowMs = 15 * 60_000;

export const unansweredAttemptMs = 60_000;

export interface RetryCandidate {
  status: OrderStatus;
  dueAt: Date;
  latestAttempt: { status: PaymentAttemptStatus; updatedAt: Date } | null;
}

const closedOrderMessages: Record<
  Exclude<OrderStatus, 'pending_payment'>,
  string
> = {
  paid: 'This order is already paid',
  cancelled:
    'This order was cancelled because it was not paid in time. Place a new order.',
  refund_pending: 'This order is being refunded',
  refunded: 'This order was refunded',
};

export function paymentRetryProblem(
  { status, dueAt, latestAttempt }: RetryCandidate,
  now: Date,
): string | null {
  if (status !== 'pending_payment') {
    return closedOrderMessages[status];
  }

  if (dueAt.getTime() <= now.getTime()) {
    return 'This order expired before it was paid. Place a new order.';
  }

  if (!latestAttempt) {
    return null;
  }

  const stillAnswering =
    latestAttempt.status === 'requested' &&
    now.getTime() - latestAttempt.updatedAt.getTime() < unansweredAttemptMs;

  if (
    latestAttempt.status === 'processing' ||
    latestAttempt.status === 'succeeded' ||
    stillAnswering
  ) {
    return 'A payment for this order is still being processed';
  }

  return null;
}
