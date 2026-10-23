import { Command } from '@nestjs/cqrs';
import { OrderAttempt } from './order-attempt.js';

export class StartPaymentAttemptCommand extends Command<OrderAttempt> {
  constructor(
    public readonly reference: string,
    public readonly idempotencyKey: string,
  ) {
    super();
  }
}
