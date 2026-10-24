import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ProductSearchOutbox } from '../../product-search-outbox.js';
import { CompleteProductSearchChangesCommand } from '../complete-product-search-changes.command.js';

@CommandHandler(CompleteProductSearchChangesCommand)
export class CompleteProductSearchChangesCommandHandler implements ICommandHandler<CompleteProductSearchChangesCommand> {
  constructor(private readonly outbox: ProductSearchOutbox) {}

  @Transactional()
  execute({ ids }: CompleteProductSearchChangesCommand): Promise<void> {
    return this.outbox.complete(ids);
  }
}
