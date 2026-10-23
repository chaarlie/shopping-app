import { PaymentEntity } from '../entities/payment.entity.js';
import { ProviderResponse } from '../simulated-card-provider.js';

export type NewPayment = Pick<
  PaymentEntity,
  | 'id'
  | 'orderReference'
  | 'idempotencyKey'
  | 'requestHash'
  | 'amountCents'
  | 'currency'
  | 'cardBrand'
  | 'cardLast4'
  | 'providerResponse'
  | 'settleAt'
>;

export abstract class PaymentRepository {
  abstract findById(id: string): Promise<PaymentEntity | null>;

  abstract findByIdForUpdate(id: string): Promise<PaymentEntity | null>;

  abstract findByIdempotencyKey(key: string): Promise<PaymentEntity | null>;

  abstract findByOrderReference(
    orderReference: string,
  ): Promise<PaymentEntity[]>;

  abstract insert(payment: NewPayment): Promise<PaymentEntity>;

  abstract findDueForSettlement(limit: number): Promise<PaymentEntity[]>;

  abstract markSettled(
    id: string,
    response: ProviderResponse,
  ): Promise<PaymentEntity>;

  abstract markRefunded(
    id: string,
    idempotencyKey: string,
  ): Promise<PaymentEntity>;
}
