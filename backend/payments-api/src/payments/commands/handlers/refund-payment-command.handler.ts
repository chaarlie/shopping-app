import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictError, NotFoundError } from '../../../common/errors.js';
import { PaymentEntity } from '../../entities/payment.entity.js';
import { PaymentRepository } from '../../repositories/payment.repository.js';
import { RefundPaymentCommand } from '../refund-payment.command.js';

@CommandHandler(RefundPaymentCommand)
export class RefundPaymentCommandHandler implements ICommandHandler<RefundPaymentCommand> {
  constructor(private readonly payments: PaymentRepository) {}

  @Transactional()
  async execute({
    paymentId,
    idempotencyKey,
  }: RefundPaymentCommand): Promise<PaymentEntity> {
    const payment = await this.payments.findByIdForUpdate(paymentId);

    if (!payment) {
      throw new NotFoundError(`Payment ${paymentId} was not found`);
    }

    if (payment.refundIdempotencyKey === idempotencyKey) {
      return payment;
    }

    if (payment.status !== 'succeeded') {
      throw new ConflictError(
        `Only a succeeded payment can be refunded, and payment ${paymentId} is ${payment.status}`,
      );
    }

    return this.payments.markRefunded(paymentId, idempotencyKey);
  }
}
