import { TypeOrmImportRepository } from './repositories/typeorm-import.repository.js';
import { Module } from '@nestjs/common';
import { ImportRepository } from './repositories/import.repository.js';
import { ImportCommandHandler } from './commands/handlers/import-command.handler.js';
import {
  ImportPreviewQueryHandler,
  ImportHistoryQueryHandler,
  ImportDownloadQueryHandler,
} from './queries/handlers/import-query.handler.js';
import { ImportsRestController } from './controllers/imports-rest.controller.js';
@Module({
  controllers: [ImportsRestController],
  providers: [
    { provide: ImportRepository, useClass: TypeOrmImportRepository },
    ImportCommandHandler,
    ImportPreviewQueryHandler,
    ImportHistoryQueryHandler,
    ImportDownloadQueryHandler,
  ],
})
export class ImportsModule {}
