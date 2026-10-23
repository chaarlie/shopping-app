import type { PaymentEvent } from '@shop/contracts';
import { PaymentEntity } from './entities/payment.entity.js';

export function paymentEventFor(
  payment: PaymentEntity,
  { id, createdAt }: { id: string; createdAt: Date },
): PaymentEvent {
  const data = {
    paymentId: payment.id,
    orderReference: payment.orderReference,
    idempotencyKey: payment.idempotencyKey,
    amountCents: payment.amountCents,
    currency: payment.currency,
    cardLast4: payment.cardLast4,
  };

  if (payment.status === 'succeeded') {
    return {
      id,
      type: 'payment.succeeded',
      createdAt: createdAt.toISOString(),
      data,
    };
  }

  return {
    id,
    type: 'payment.failed',
    createdAt: createdAt.toISOString(),
    data: {
      ...data,
      failureCode: payment.failureCode ?? 'unknown',
      failureMessage: payment.failureMessage ?? 'The payment failed.',
    },
  };
}
