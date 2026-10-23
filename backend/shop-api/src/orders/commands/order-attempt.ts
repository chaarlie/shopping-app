import { OrderEntity } from '../entities/order.entity.js';
import { PaymentAttemptEntity } from '../entities/payment-attempt.entity.js';

export interface OrderAttempt {
  order: OrderEntity;
  attempt: PaymentAttemptEntity;
}
