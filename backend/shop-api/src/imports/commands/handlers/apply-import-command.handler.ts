import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ImportReview } from '../../import-review.js';
import { ApplyImportCommand } from '../import.command.js';
import { ConflictError } from '../../../common/errors.js';
import { ProductImportWriter } from '../../../products/import/product-import-writer.js';
import { ImportRepository } from '../../repositories/import.repository.js';
@CommandHandler(ApplyImportCommand)
export class ApplyImportCommandHandler implements ICommandHandler<ApplyImportCommand> {
  constructor(
    private readonly imports: ImportRepository,
    private readonly review: ImportReview,
    private readonly writer: ProductImportWriter,
  ) {}
  @Transactional()
  async execute({ adminId, id, version }: ApplyImportCommand) {
    const stored = await this.review.lock(id);
    if (stored.applied_at) {
      return this.review.summary(id);
    }
    this.review.assertEditable(stored, version);
    const plan = await this.review.prepare(id, stored.update_stock, true);
    if (plan.hash !== stored.catalog_hash) {
      throw new ConflictError(
        'Products in this import changed since the preview. Refresh and review the changes before applying.',
      );
    }
    if (
      plan.results.some((row) =>
        row.errors.some((error) => error.includes('appears on rows')),
      )
    ) {
      throw new ConflictError(
        'Resolve conflicting SKUs before applying: keep one row, edit the SKUs, or exclude the conflicting rows.',
      );
    }
    await this.writer.apply(plan.matched);
    await this.imports.markApplied(id, adminId);
    return this.review.save(id, plan);
  }
}
