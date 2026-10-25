import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { ImportSummary } from '@shop/contracts';
import {
  ImportRepository,
  type StoredRow,
  type StoredImport,
} from './import.repository.js';
@Injectable()
export class TypeOrmImportRepository extends ImportRepository {
  constructor(
    private readonly host: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {
    super();
  }
  query<T>(sql: string, params: unknown[] = []): Promise<T> {
    return this.host.tx.query(sql, params);
  }
  async lock(id: number): Promise<StoredImport | undefined> {
    return (
      await this.query<StoredImport[]>(
        'SELECT * FROM product_imports WHERE id=$1 FOR UPDATE',
        [id],
      )
    )[0];
  }
  rows(id: number): Promise<StoredRow[]> {
    return this.query(
      'SELECT r.*,a.name AS editor FROM product_import_rows r LEFT JOIN admins a ON a.id=r.edited_by WHERE import_id=$1 ORDER BY row_number',
      [id],
    );
  }
  async summary(id: number): Promise<ImportSummary | undefined> {
    return (await this.summaries('WHERE i.id=$1', [id]))[0];
  }
  summaries(where: string, params: unknown[]): Promise<ImportSummary[]> {
    return this.query(
      `SELECT i.id,i.filename,i.file_error AS "fileError",octet_length(i.file) AS size,i.sha256,u.name AS "uploadedBy",i.uploaded_at::text AS "uploadedAt",a.name AS "appliedBy",i.applied_at::text AS "appliedAt",i.version,i.update_stock AS "updateStock",i.counts,i.total_rows AS "totalRows",i.blank_rows AS "blankRows" FROM product_imports i JOIN admins u ON u.id=i.uploaded_by LEFT JOIN admins a ON a.id=i.applied_by ${where}`,
      params,
    );
  }
}
