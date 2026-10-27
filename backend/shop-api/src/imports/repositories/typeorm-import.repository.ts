import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { createHash } from 'node:crypto';
import type { ProductImportPlan } from '../../products/import/plan-product-import.js';
import type { ProductCsvValues } from '../../products/import/product-csv.js';
import type { ImportSummary, StagedRow } from '@shop/contracts';
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
  private query<T>(sql: string, params: unknown[] = []): Promise<T> {
    return this.host.tx.query(sql, params);
  }
  async createUpload(
    filename: string,
    file: Buffer,
    adminId: number,
    plan: ProductImportPlan,
    fileError: string | null,
  ): Promise<number> {
    const [inserted] = await this.query<{ id: number }[]>(
      'INSERT INTO product_imports(filename,file,sha256,uploaded_by,total_rows,blank_rows,file_error) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [
        filename,
        file,
        createHash('sha256').update(file).digest('hex'),
        adminId,
        plan.totalRows,
        plan.blankRows,
        fileError,
      ],
    );
    for (const row of plan.rows) {
      await this.query(
        "INSERT INTO product_import_rows(import_id,row_number,values,original_errors,result) VALUES($1,$2,$3,$4,'{}')",
        [
          inserted.id,
          row.row,
          JSON.stringify(row.values),
          JSON.stringify(
            row.errors.filter((error) => error.startsWith('Expected ')),
          ),
        ],
      );
    }
    return inserted.id;
  }
  async editRow(
    id: number,
    row: StoredRow,
    values: ProductCsvValues,
    excluded: boolean,
    adminId: number,
  ): Promise<void> {
    await this.query(
      'INSERT INTO product_import_edits(import_id,row_number,admin_id,before_value,after_value) VALUES($1,$2,$3,$4,$5)',
      [
        id,
        row.row_number,
        adminId,
        JSON.stringify({ values: row.values, excluded: row.excluded }),
        JSON.stringify({ values, excluded }),
      ],
    );
    await this.query(
      'UPDATE product_import_rows SET values=$3,excluded=$4,edited_by=$5,edited_at=now() WHERE import_id=$1 AND row_number=$2',
      [id, row.row_number, JSON.stringify(values), excluded, adminId],
    );
  }
  async setStockPolicy(id: number, updateStock: boolean): Promise<void> {
    await this.query('UPDATE product_imports SET update_stock=$2 WHERE id=$1', [
      id,
      updateStock,
    ]);
  }
  async markApplied(id: number, adminId: number): Promise<void> {
    await this.query(
      'UPDATE product_imports SET applied_at=now(),applied_by=$2 WHERE id=$1',
      [id, adminId],
    );
  }
  async savePlan(
    id: number,
    results: StagedRow[],
    counts: Record<string, number>,
    hash: string,
  ): Promise<void> {
    await this.query(
      `UPDATE product_import_rows r SET result=p.result FROM jsonb_to_recordset($2::jsonb) AS p(row integer,result jsonb) WHERE r.import_id=$1 AND r.row_number=p.row AND r.result IS DISTINCT FROM p.result`,
      [
        id,
        JSON.stringify(results.map((result) => ({ row: result.row, result }))),
      ],
    );
    await this.query(
      'UPDATE product_imports SET catalog_hash=$2,counts=$3,version=version+1 WHERE id=$1',
      [id, hash, JSON.stringify(counts)],
    );
  }
  async previewRows(
    id: number,
    page: number,
    pageSize: number,
    status: string,
    sku?: string,
  ) {
    const where =
      "import_id=$1 AND ($2='all' OR result->>'status'=$2) AND ($3::text IS NULL OR upper(trim(values->>'sku'))=upper($3))";
    const rows = await this.query<{ result: StagedRow }[]>(
      `SELECT result FROM product_import_rows WHERE ${where} ORDER BY row_number LIMIT $4 OFFSET $5`,
      [id, status, sku ?? null, pageSize, (page - 1) * pageSize],
    );
    const counts = await this.query<{ count: string }[]>(
      `SELECT count(*) FROM product_import_rows WHERE ${where}`,
      [id, status, sku ?? null],
    );
    return {
      rows: rows.map((row) => row.result),
      total: Number(counts[0].count),
    };
  }
  async history(page: number, pageSize: number) {
    const items = await this.summaries(
      'ORDER BY i.uploaded_at DESC,i.id DESC LIMIT $1 OFFSET $2',
      [pageSize, (page - 1) * pageSize],
    );
    const rows = await this.query<{ count: string }[]>(
      'SELECT count(*) FROM product_imports',
    );
    return { items, total: Number(rows[0].count) };
  }
  async download(id: number) {
    return (
      await this.query<{ filename: string; file: Buffer }[]>(
        'SELECT filename,file FROM product_imports WHERE id=$1',
        [id],
      )
    )[0];
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
  private summaries(
    where: string,
    params: unknown[],
  ): Promise<ImportSummary[]> {
    return this.query(
      `SELECT i.id,i.filename,i.file_error AS "fileError",octet_length(i.file) AS size,i.sha256,u.name AS "uploadedBy",i.uploaded_at::text AS "uploadedAt",a.name AS "appliedBy",i.applied_at::text AS "appliedAt",i.version,i.update_stock AS "updateStock",i.counts,i.total_rows AS "totalRows",i.blank_rows AS "blankRows" FROM product_imports i JOIN admins u ON u.id=i.uploaded_by LEFT JOIN admins a ON a.id=i.applied_by ${where}`,
      params,
    );
  }
}
