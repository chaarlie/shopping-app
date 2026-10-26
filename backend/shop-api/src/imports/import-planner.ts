import { createHash } from 'node:crypto';
import {
  productCsvColumns,
  type CreateProductInput,
  type StagedRow,
} from '@shop/contracts';
import { planProductImport } from '../products/import/plan-product-import.js';
import { matchExistingProducts } from '../products/import/match-existing-products.js';
import type { StoredRow } from './repositories/import.repository.js';
export type CatalogProduct = CreateProductInput & {
  id: number;
  version: number;
};
export function catalogHash(products: CatalogProduct[]): string {
  return createHash('sha256')
    .update(JSON.stringify(products.map((p) => [p.id, p.version])))
    .digest('hex');
}
export function planStoredRows(
  rows: StoredRow[],
  products: CatalogProduct[],
  updateStock: boolean,
) {
  const included = rows.filter((r) => !r.excluded);
  const csv = [
    productCsvColumns.join(','),
    ...included.map((row) =>
      productCsvColumns
        .map((c) => '"' + row.values[c].replaceAll('"', '""') + '"')
        .join(','),
    ),
  ].join('\n');
  const plan = planProductImport(csv);
  const existing = new Map(products.map((p) => [p.sku, p]));
  const ready = plan.rows.map((row) => {
    const stored = included[row.row - 2];
    const remap = (message: string) =>
      message.replace(
        /(rows? )([0-9, and]+)/g,
        (_, prefix: string, numbers: string) =>
          prefix +
          numbers.replace(/\d+/g, (number) =>
            String(included[Number(number) - 2]?.row_number ?? number),
          ),
      );
    row = {
      ...row,
      errors: row.errors.map(remap),
      warnings: row.warnings.map(remap),
    };
    if (stored.original_errors.length && !stored.edited_at) {
      return {
        ...row,
        row: stored.row_number,
        status: 'error' as const,
        product: null,
        errors: stored.original_errors,
      };
    }
    const product = row.product && existing.get(row.product.sku);
    return {
      ...row,
      row: stored.row_number,
      product:
        row.product && product && !updateStock
          ? { ...row.product, stock: product.stock }
          : row.product,
    };
  });
  const matched = matchExistingProducts(ready, existing, 'update');
  const byRow = new Map(matched.map((row) => [row.row, row]));
  const counts: Record<string, number> = {
    create: 0,
    update: 0,
    unchanged: 0,
    duplicate: 0,
    error: 0,
    excluded: 0,
    skip: 0,
  };
  const results: StagedRow[] = rows.map((row) => {
    const planned = byRow.get(row.row_number);
    const product = planned?.product;
    const before = product && existing.get(product.sku);
    const changes =
      before && product
        ? (
            [
              'name',
              'description',
              'category',
              'priceCents',
              'stock',
              'weightGrams',
            ] as const
          ).flatMap((field) =>
            before[field] === product[field]
              ? []
              : [
                  {
                    field,
                    before: String(before[field] ?? ''),
                    after: String(product[field] ?? ''),
                  },
                ],
          )
        : [];
    const status = row.excluded ? 'excluded' : (planned?.status ?? 'error');
    counts[status]++;
    return {
      row: row.row_number,
      status,
      values: row.values,
      errors: row.excluded
        ? []
        : (planned?.errors ??
          (row.original_errors.length && !row.edited_at
            ? row.original_errors
            : ['Row is empty. Enter product values or exclude this row.'])),
      warnings: planned?.warnings ?? [],
      changes,
      excluded: row.excluded,
      editedBy: row.editor,
      editedAt: row.edited_at?.toISOString() ?? null,
    };
  });
  return { results, counts, matched };
}
