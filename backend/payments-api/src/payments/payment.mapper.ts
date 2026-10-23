import { Payment } from '@shop/contracts';
import { PaymentEntity } from './entities/payment.entity.js';

export function toPayment(entity: PaymentEntity): Payment {
  return {
    id: entity.id,
    orderReference: entity.orderReference,
    status: entity.status,
    amountCents: entity.amountCents,
    currency: entity.currency,
    cardBrand: entity.cardBrand,
    cardLast4: entity.cardLast4,
    failureCode: entity.failureCode,
    failureMessage: entity.failureMessage,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
