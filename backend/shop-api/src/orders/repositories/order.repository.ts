import type { OrderStatus } from '@shop/contracts';
import { OrderLineEntity } from '../entities/order-line.entity.js';
import { OrderEntity } from '../entities/order.entity.js';
import { PaymentAttemptEntity } from '../entities/payment-attempt.entity.js';

export interface OrderAggregate {
  order: OrderEntity;
  lines: OrderLineEntity[];
  attempts: PaymentAttemptEntity[];
}

export type NewOrder = Pick<
  OrderEntity,
  | 'reference'
  | 'idempotencyKey'
  | 'requestHash'
  | 'name'
  | 'email'
  | 'totalCents'
  | 'currency'
  | 'dueAt'
>;

export type NewOrderLine = Pick<
  OrderLineEntity,
  'productId' | 'sku' | 'name' | 'unitPriceCents' | 'quantity'
>;

export type OrderChanges = Partial<Pick<OrderEntity, 'status' | 'paymentId'>>;

export type PaymentAttemptChanges = Partial<
  Pick<
    PaymentAttemptEntity,
    'paymentId' | 'status' | 'cardLast4' | 'declineCode' | 'declineMessage'
  >
>;

export abstract class OrderRepository {
  abstract referenceExists(reference: string): Promise<boolean>;

  abstract findByReference(reference: string): Promise<OrderAggregate | null>;

  abstract findByReferenceForUpdate(
    reference: string,
  ): Promise<OrderAggregate | null>;

  abstract findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OrderAggregate | null>;

  abstract create(
    order: NewOrder,
    lines: NewOrderLine[],
    attemptKey: string,
  ): Promise<OrderAggregate>;

  abstract transition(
    id: number,
    from: OrderStatus,
    changes: OrderChanges,
  ): Promise<boolean>;

  abstract touch(id: number): Promise<void>;

  abstract deferReconciliation(id: number): Promise<void>;

  abstract addAttempt(
    orderId: number,
    idempotencyKey: string,
  ): Promise<PaymentAttemptEntity>;

  abstract updateAttempt(
    id: number,
    changes: PaymentAttemptChanges,
  ): Promise<void>;
}
