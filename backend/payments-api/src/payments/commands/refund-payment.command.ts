import { Command } from '@nestjs/cqrs';
import { PaymentEntity } from '../entities/payment.entity.js';

export class RefundPaymentCommand extends Command<PaymentEntity> {
  constructor(
    public readonly paymentId: string,
    public readonly idempotencyKey: string,
  ) {
    super();
  }
}
