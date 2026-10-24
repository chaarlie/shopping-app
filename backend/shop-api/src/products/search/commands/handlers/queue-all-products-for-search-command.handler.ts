import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ProductSearchOutbox } from '../../product-search-outbox.js';
import { QueueAllProductsForSearchCommand } from '../queue-all-products-for-search.command.js';

@CommandHandler(QueueAllProductsForSearchCommand)
export class QueueAllProductsForSearchCommandHandler implements ICommandHandler<QueueAllProductsForSearchCommand> {
  constructor(private readonly outbox: ProductSearchOutbox) {}

  @Transactional()
  execute(): Promise<number> {
    return this.outbox.queueAll();
  }
}
