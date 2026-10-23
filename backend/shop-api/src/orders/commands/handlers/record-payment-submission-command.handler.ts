import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { OrderUpdatesPublisher } from '../../order-updates.publisher.js';
import { OrderRepository } from '../../repositories/order.repository.js';
import { RecordPaymentSubmissionCommand } from '../record-payment-submission.command.js';

@CommandHandler(RecordPaymentSubmissionCommand)
export class RecordPaymentSubmissionCommandHandler implements ICommandHandler<RecordPaymentSubmissionCommand> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly updates: OrderUpdatesPublisher,
  ) {}

  @Transactional()
  async execute({
    reference,
    attemptId,
    submission,
  }: RecordPaymentSubmissionCommand): Promise<void> {
    const found = await this.orders.findByReferenceForUpdate(reference);
    const attempt = found?.attempts.find(({ id }) => id === attemptId);

    if (!found || attempt?.status !== 'requested') {
      return;
    }

    await this.orders.updateAttempt(
      attemptId,
      submission.kind === 'accepted'
        ? {
            status: 'processing',
            paymentId: submission.payment.id,
            cardLast4: submission.payment.cardLast4,
          }
        : {
            status: 'declined',
            declineCode: submission.code,
            declineMessage: submission.message,
          },
    );
    await this.orders.touch(found.order.id);
    await this.updates.publish(reference);
  }
}
