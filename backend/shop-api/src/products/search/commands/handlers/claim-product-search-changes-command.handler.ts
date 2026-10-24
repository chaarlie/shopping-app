import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { QueuedProductChange } from '../../product-search-document.js';
import { ProductSearchOutbox } from '../../product-search-outbox.js';
import { ClaimProductSearchChangesCommand } from '../claim-product-search-changes.command.js';

@CommandHandler(ClaimProductSearchChangesCommand)
export class ClaimProductSearchChangesCommandHandler implements ICommandHandler<ClaimProductSearchChangesCommand> {
  constructor(private readonly outbox: ProductSearchOutbox) {}

  @Transactional()
  execute({
    limit,
    leaseMs,
  }: ClaimProductSearchChangesCommand): Promise<QueuedProductChange[]> {
    return this.outbox.claim(limit, leaseMs);
  }
}
