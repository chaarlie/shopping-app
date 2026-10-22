import {
  CreateProductInput,
  ProductImportOptions,
  ProductImportStatus,
} from '@shop/contracts';
import { PlannedProductRow } from './plan-product-import.js';

export interface ExistingProduct extends CreateProductInput {
  id: number;
}

export interface MatchedProductRow extends Omit<PlannedProductRow, 'status'> {
  status: ProductImportStatus;
  existingId: number | null;
}

export function matchExistingProducts(
  rows: PlannedProductRow[],
  existingBySku: Map<string, ExistingProduct>,
  onExisting: ProductImportOptions['onExisting'],
): MatchedProductRow[] {
  return rows.map((row) => {
    if (row.status !== 'ready' || !row.product) {
      return {
        ...row,
        status: row.status === 'duplicate' ? 'duplicate' : 'error',
        existingId: null,
      };
    }

    const existing = existingBySku.get(row.product.sku);

    if (!existing) {
      return { ...row, status: 'create', existingId: null };
    }

    if (sameValues(row.product, existing)) {
      return { ...row, status: 'unchanged', existingId: existing.id };
    }

    return {
      ...row,
      status: onExisting === 'skip' ? 'skip' : 'update',
      existingId: existing.id,
    };
  });
}

function sameValues(
  product: CreateProductInput,
  existing: CreateProductInput,
): boolean {
  return (
    product.name === existing.name &&
    product.description === existing.description &&
    product.category === existing.category &&
    product.priceCents === existing.priceCents &&
    product.stock === existing.stock &&
    product.weightGrams === existing.weightGrams
  );
}
