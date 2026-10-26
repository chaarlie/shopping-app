import type { ImportSummary, StagedRow, ImportPreview } from '@shop/contracts';
import type { ProductImportPlan } from '../../products/import/plan-product-import.js';
import type { ProductCsvValues } from '../../products/import/product-csv.js';
export type StoredRow = {
  row_number: number;
  values: ProductCsvValues;
  original_errors: string[];
  excluded: boolean;
  edited_by: number | null;
  edited_at: Date | null;
  editor: string | null;
  result: StagedRow;
};
export type StoredImport = {
  id: number;
  version: number;
  applied_at: Date | null;
  update_stock: boolean;
  catalog_hash: string;
  file_error: string | null;
};
export abstract class ImportRepository {
  abstract createUpload(
    filename: string,
    file: Buffer,
    adminId: number,
    plan: ProductImportPlan,
    fileError: string | null,
  ): Promise<number>;
  abstract editRow(
    id: number,
    row: StoredRow,
    values: ProductCsvValues,
    excluded: boolean,
    adminId: number,
  ): Promise<void>;
  abstract setStockPolicy(id: number, updateStock: boolean): Promise<void>;
  abstract markApplied(id: number, adminId: number): Promise<void>;
  abstract savePlan(
    id: number,
    results: StagedRow[],
    counts: Record<string, number>,
    hash: string,
  ): Promise<void>;
  abstract previewRows(
    id: number,
    page: number,
    pageSize: number,
    status: string,
    sku?: string,
  ): Promise<Pick<ImportPreview, 'rows' | 'total'>>;
  abstract history(
    page: number,
    pageSize: number,
  ): Promise<{ items: ImportSummary[]; total: number }>;
  abstract download(
    id: number,
  ): Promise<{ filename: string; file: Buffer } | undefined>;
  abstract lock(id: number): Promise<StoredImport | undefined>;
  abstract rows(id: number): Promise<StoredRow[]>;
  abstract summary(id: number): Promise<ImportSummary | undefined>;
}
