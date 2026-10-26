import type { ImportSummary, StagedRow } from '@shop/contracts';
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
  abstract query<T>(sql: string, params?: unknown[]): Promise<T>;
  abstract lock(id: number): Promise<StoredImport | undefined>;
  abstract rows(id: number): Promise<StoredRow[]>;
  abstract summary(id: number): Promise<ImportSummary | undefined>;
  abstract summaries(
    where: string,
    params: unknown[],
  ): Promise<ImportSummary[]>;
}
