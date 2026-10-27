import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import type { ProductImportPlan } from '../../products/import/plan-product-import.js';
import { ImportUploadJobRepository } from './import-upload-job.repository.js';
import { ImportRepository } from '../repositories/import.repository.js';
import { ImportReview } from '../import-review.js';
export class StageUploadCommand {
  constructor(
    readonly id: string,
    readonly token: string,
    readonly file: Buffer,
    readonly plan: ProductImportPlan,
    readonly fileError: string | null,
  ) {}
}
@CommandHandler(StageUploadCommand)
export class StageUploadCommandHandler implements ICommandHandler<StageUploadCommand> {
  constructor(
    private readonly jobs: ImportUploadJobRepository,
    private readonly imports: ImportRepository,
    private readonly review: ImportReview,
  ) {}
  @Transactional()
  async execute({ id, token, file, plan, fileError }: StageUploadCommand) {
    const upload = await this.jobs.lock(id, token);
    if (!upload) {
      return;
    }
    const importId = await this.imports.createUpload(
      upload.filename,
      file,
      upload.admin_id,
      plan,
      fileError,
      upload.object_key,
    );
    if (!fileError) {
      await this.review.save(
        importId,
        await this.review.prepare(importId, false),
      );
    }
    await this.jobs.finish(id, token, importId);
  }
}
