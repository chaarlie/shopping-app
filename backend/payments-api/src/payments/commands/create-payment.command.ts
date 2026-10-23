import { Command } from '@nestjs/cqrs';
import { CreatePaymentInput } from '@shop/contracts';
import { PaymentEntity } from '../entities/payment.entity.js';

export class CreatePaymentCommand extends Command<PaymentEntity> {
  constructor(
    public readonly input: CreatePaymentInput,
    public readonly idempotencyKey: string,
  ) {
    super();
  }
}
