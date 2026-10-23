import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictError, NotFoundError } from '../../../common/errors.js';
import { paymentRetryProblem } from '../../domain/payment-rules.js';
import { OrderUpdatesPublisher } from '../../order-updates.publisher.js';
import { OrderRepository } from '../../repositories/order.repository.js';
import { OrderAttempt } from '../order-attempt.js';
import { StartPaymentAttemptCommand } from '../start-payment-attempt.command.js';

@CommandHandler(StartPaymentAttemptCommand)
export class StartPaymentAttemptCommandHandler implements ICommandHandler<StartPaymentAttemptCommand> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly updates: OrderUpdatesPublisher,
  ) {}

  @Transactional()
  async execute({
    reference,
    idempotencyKey,
  }: StartPaymentAttemptCommand): Promise<OrderAttempt> {
    const found = await this.orders.findByReferenceForUpdate(reference);

    if (!found) {
      throw new NotFoundError(`Order ${reference} was not found`);
    }

    const attemptKey = `${reference}:${idempotencyKey}`;
    const repeated = found.attempts.find(
      (attempt) => attempt.idempotencyKey === attemptKey,
    );

    if (repeated) {
      return { order: found.order, attempt: repeated };
    }

    const problem = paymentRetryProblem(
      {
        status: found.order.status,
        dueAt: found.order.dueAt,
        latestAttempt: found.attempts.at(-1) ?? null,
      },
      new Date(),
    );

    if (problem) {
      throw new ConflictError(problem);
    }

    const attempt = await this.orders.addAttempt(found.order.id, attemptKey);
    await this.orders.touch(found.order.id);
    await this.updates.publish(reference);

    return { order: found.order, attempt };
  }
}
