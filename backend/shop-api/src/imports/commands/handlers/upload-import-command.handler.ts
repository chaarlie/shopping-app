import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ImportReview } from '../../import-review.js';
import { UploadImportCommand } from '../import.command.js';
import { ValidationError } from '../../../common/errors.js';
import {
  planProductImport,
  ProductImportPlan,
} from '../../../products/import/plan-product-import.js';
import { ImportRepository } from '../../repositories/import.repository.js';
@CommandHandler(UploadImportCommand)
export class UploadImportCommandHandler implements ICommandHandler<UploadImportCommand> {
  constructor(
    private readonly imports: ImportRepository,
    private readonly review: ImportReview,
  ) {}
  @Transactional()
  async execute({ adminId, filename, file }: UploadImportCommand) {
    if (file.length > 1000000 || file.length === 0) {
      throw new ValidationError('Choose a non-empty CSV file up to 1 MB');
    }
    let plan: ProductImportPlan = {
      totalRows: 0,
      blankRows: 0,
      ignoredColumns: [],
      rows: [],
    };
    let fileError: string | null = null;
    try {
      plan = planProductImport(file.toString('utf8'));
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
      fileError = error.message;
    }
    const id = await this.imports.createUpload(
      filename,
      file,
      adminId,
      plan,
      fileError,
    );
    if (fileError) {
      return this.review.summary(id);
    }
    return this.review.save(id, await this.review.prepare(id, false));
  }
}
