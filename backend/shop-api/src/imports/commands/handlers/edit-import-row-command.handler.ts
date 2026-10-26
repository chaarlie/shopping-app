import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ImportReview } from '../../import-review.js';
import { EditImportRowCommand } from '../import.command.js';
import { NotFoundError } from '../../../common/errors.js';
import { ImportRepository } from '../../repositories/import.repository.js';
@CommandHandler(EditImportRowCommand)
export class EditImportRowCommandHandler implements ICommandHandler<EditImportRowCommand> {
  constructor(
    private readonly imports: ImportRepository,
    private readonly review: ImportReview,
  ) {}
  @Transactional()
  async execute({ adminId, id, row: rowNumber, input }: EditImportRowCommand) {
    const stored = await this.review.lock(id);
    this.review.assertEditable(stored, input.version);
    const row = (await this.imports.rows(id)).find(
      (item) => item.row_number === rowNumber,
    );
    if (!row) {
      throw new NotFoundError('Import row not found');
    }
    await this.imports.editRow(
      id,
      row,
      input.values ?? row.values,
      input.excluded ?? row.excluded,
      adminId,
    );
    return this.review.save(
      id,
      await this.review.prepare(id, stored.update_stock),
    );
  }
}
