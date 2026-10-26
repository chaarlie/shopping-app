import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { StagedRow } from '@shop/contracts';
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
    const where =
      "import_id=$1 AND ($2='all' OR result->>'status'=$2) AND ($3::text IS NULL OR upper(trim(values->>'sku'))=upper($3))";
    const rows = await this.imports.query<{ result: StagedRow }[]>(
      `SELECT result FROM product_import_rows WHERE ${where} ORDER BY row_number LIMIT $4 OFFSET $5`,
      [id, status, sku ?? null, pageSize, (page - 1) * pageSize],
    );
    const counts = await this.imports.query<{ count: string }[]>(
      `SELECT count(*) FROM product_import_rows WHERE ${where}`,
      [id, status, sku ?? null],
    );
    return {
      summary,
      rows: rows.map((r) => r.result),
      page,
      pageSize,
      total: Number(counts[0].count),
    };
  }
}
@QueryHandler(ImportHistoryQuery)
export class ImportHistoryQueryHandler implements IQueryHandler<ImportHistoryQuery> {
  constructor(private readonly imports: ImportRepository) {}
  async execute({ page, pageSize }: ImportHistoryQuery) {
    const items = await this.imports.summaries(
      'ORDER BY i.uploaded_at DESC,i.id DESC LIMIT $1 OFFSET $2',
      [pageSize, (page - 1) * pageSize],
    );
    const rows = await this.imports.query<{ count: string }[]>(
      'SELECT count(*) FROM product_imports',
    );
    return { items, page, pageSize, total: Number(rows[0].count) };
  }
}
@QueryHandler(ImportDownloadQuery)
export class ImportDownloadQueryHandler implements IQueryHandler<ImportDownloadQuery> {
  constructor(private readonly imports: ImportRepository) {}
  async execute({ id }: ImportDownloadQuery) {
    const rows = await this.imports.query<{ filename: string; file: Buffer }[]>(
      'SELECT filename,file FROM product_imports WHERE id=$1',
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundError('Import not found');
    }
    return rows[0];
  }
}
