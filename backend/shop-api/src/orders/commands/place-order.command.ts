import { Command } from '@nestjs/cqrs';
import { PlaceOrderInput } from '@shop/contracts';
import { OrderAttempt } from './order-attempt.js';

export class PlaceOrderCommand extends Command<OrderAttempt> {
  constructor(
    public readonly input: PlaceOrderInput,
    public readonly idempotencyKey: string,
  ) {
    super();
  }
}
