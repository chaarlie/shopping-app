import {
  ImportUploadJob,
  ProcessUploadCommandHandler,
} from './uploads/import-upload.job.js';
import { ImportUploadJobRepository } from './uploads/import-upload-job.repository.js';
import { StageUploadCommandHandler } from './uploads/stage-upload-command.handler.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { ProductsModule } from '../products/products.module.js';
import { TypeOrmImportRepository } from './repositories/typeorm-import.repository.js';
import { Module } from '@nestjs/common';
import { ImportRepository } from './repositories/import.repository.js';
import { ImportReview } from './import-review.js';
import { UploadImportCommandHandler } from './commands/handlers/upload-import-command.handler.js';
import { EditImportRowCommandHandler } from './commands/handlers/edit-import-row-command.handler.js';
import { RefreshImportCommandHandler } from './commands/handlers/refresh-import-command.handler.js';
import { ApplyImportCommandHandler } from './commands/handlers/apply-import-command.handler.js';
import {
  ImportPreviewQueryHandler,
  ImportHistoryQueryHandler,
  ImportDownloadQueryHandler,
} from './queries/handlers/import-query.handler.js';
import { ImportsRestController } from './controllers/imports-rest.controller.js';
@Module({
  imports: [ProductsModule, UploadsModule],
  controllers: [ImportsRestController],
  providers: [
    ImportUploadJob,
    ProcessUploadCommandHandler,
    ImportUploadJobRepository,
    StageUploadCommandHandler,
    { provide: ImportRepository, useClass: TypeOrmImportRepository },
    ImportReview,
    UploadImportCommandHandler,
    EditImportRowCommandHandler,
    RefreshImportCommandHandler,
    ApplyImportCommandHandler,

    ImportPreviewQueryHandler,
    ImportHistoryQueryHandler,
    ImportDownloadQueryHandler,
  ],
})
export class ImportsModule {}
