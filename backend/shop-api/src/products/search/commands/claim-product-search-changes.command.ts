import { Command } from '@nestjs/cqrs';
import { QueuedProductChange } from '../product-search-document.js';

export class ClaimProductSearchChangesCommand extends Command<
  QueuedProductChange[]
> {
  constructor(
    public readonly limit: number,
    public readonly leaseMs: number,
  ) {
    super();
  }
}
