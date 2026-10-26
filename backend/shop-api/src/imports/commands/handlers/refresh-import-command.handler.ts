import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ImportReview } from '../../import-review.js';
import { RefreshImportCommand } from '../import.command.js';
import { ImportRepository } from '../../repositories/import.repository.js';
@CommandHandler(RefreshImportCommand)
export class RefreshImportCommandHandler implements ICommandHandler<RefreshImportCommand> {
  constructor(
    private readonly imports: ImportRepository,
    private readonly review: ImportReview,
  ) {}
  @Transactional()
  async execute({ id, version, updateStock }: RefreshImportCommand) {
    const stored = await this.review.lock(id);
    this.review.assertEditable(stored, version);
    if (updateStock !== undefined) {
      await this.imports.setStockPolicy(id, updateStock);
    }
    return this.review.save(
      id,
      await this.review.prepare(id, updateStock ?? stored.update_stock),
    );
  }
}
