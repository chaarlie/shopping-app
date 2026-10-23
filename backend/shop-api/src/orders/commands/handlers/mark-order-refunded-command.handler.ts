import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { OrderUpdatesPublisher } from '../../order-updates.publisher.js';
import { OrderRepository } from '../../repositories/order.repository.js';
import { MarkOrderRefundedCommand } from '../mark-order-refunded.command.js';

@CommandHandler(MarkOrderRefundedCommand)
export class MarkOrderRefundedCommandHandler implements ICommandHandler<MarkOrderRefundedCommand> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly updates: OrderUpdatesPublisher,
  ) {}

  @Transactional()
  async execute({ reference }: MarkOrderRefundedCommand): Promise<boolean> {
    const found = await this.orders.findByReferenceForUpdate(reference);

    if (found?.order.status !== 'refund_pending') {
      return false;
    }

    await this.orders.transition(found.order.id, 'refund_pending', {
      status: 'refunded',
    });
    await this.updates.publish(reference);

    return true;
  }
}
