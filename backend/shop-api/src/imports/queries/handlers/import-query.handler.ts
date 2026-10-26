import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundError } from '../../../common/errors.js';
import { ImportRepository } from '../../repositories/import.repository.js';
import {
  ImportPreviewQuery,
  ImportHistoryQuery,
  ImportDownloadQuery,
} from '../import.query.js';
@QueryHandler(ImportPreviewQuery)
export class ImportPreviewQueryHandler implements IQueryHandler<ImportPreviewQuery> {
  constructor(private readonly imports: ImportRepository) {}
  async execute({ id, page, pageSize, status, sku }: ImportPreviewQuery) {
    const summary = await this.imports.summary(id);
    if (!summary) {
      throw new NotFoundError('Import not found');
    }
    const result = await this.imports.previewRows(
      id,
      page,
      pageSize,
      status,
      sku,
    );
    return { summary, ...result, page, pageSize };
  }
}
@QueryHandler(ImportHistoryQuery)
export class ImportHistoryQueryHandler implements IQueryHandler<ImportHistoryQuery> {
  constructor(private readonly imports: ImportRepository) {}
  async execute({ page, pageSize }: ImportHistoryQuery) {
    return { ...(await this.imports.history(page, pageSize)), page, pageSize };
  }
}
@QueryHandler(ImportDownloadQuery)
export class ImportDownloadQueryHandler implements IQueryHandler<ImportDownloadQuery> {
  constructor(private readonly imports: ImportRepository) {}
  async execute({ id }: ImportDownloadQuery) {
    const file = await this.imports.download(id);
    if (!file) {
      throw new NotFoundError('Import not found');
    }
    return file;
  }
}
