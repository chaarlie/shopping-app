import { CreateProductInput } from '@shop/contracts';
import { normalizeProductRow } from './normalize-product-row.js';
import {
  parseProductCsv,
  ProductCsvRecord,
  ProductCsvValues,
} from './product-csv.js';

export interface PlannedProductRow {
  row: number;
  status: 'ready' | 'duplicate' | 'error';
  values: ProductCsvValues;
  product: CreateProductInput | null;
  errors: string[];
  warnings: string[];
}

export interface ProductImportPlan {
  totalRows: number;
  blankRows: number;
  ignoredColumns: string[];
  rows: PlannedProductRow[];
}

export function planProductImport(
  csv: string,
  maxRows = 20_000,
): ProductImportPlan {
  const { columnCount, ignoredColumns, records } = parseProductCsv(
    csv,
    maxRows,
  );
  const filled = records.filter((record) => !isBlank(record));

  return {
    totalRows: records.length,
    blankRows: records.length - filled.length,
    ignoredColumns,
    rows: resolveRepeatedSkus(
      filled.map((record) => planRow(record, columnCount)),
    ),
  };
}

function isBlank({ values }: ProductCsvRecord): boolean {
  return Object.values(values).every((value) => value.trim() === '');
}

function planRow(
  { row, cellCount, values }: ProductCsvRecord,
  columnCount: number,
): PlannedProductRow {
  if (cellCount !== columnCount) {
    return {
      row,
      status: 'error',
      values,
      product: null,
      errors: [
        `Expected ${columnCount} values but found ${cellCount}. Check for commas outside quotes.`,
      ],
      warnings: [],
    };
  }

  const { product, errors, warnings } = normalizeProductRow(values);

  return {
    row,
    status: product ? 'ready' : 'error',
    values,
    product,
    errors,
    warnings,
  };
}

function resolveRepeatedSkus(rows: PlannedProductRow[]): PlannedProductRow[] {
  const rowsBySku = new Map<string, PlannedProductRow[]>();

  for (const row of rows) {
    const sku = normalizedSku(row);
    if (sku !== '') {
      const group = rowsBySku.get(sku) ?? [];
      group.push(row);
      rowsBySku.set(sku, group);
    }
  }

  const decisions = new Map<
    string,
    { first: PlannedProductRow; identical: boolean; error: string }
  >();
  for (const [sku, group] of rowsBySku) {
    if (group.length < 2) {
      continue;
    }
    const first = group[0];
    const identical = group.every(
      (other) =>
        other.product !== null &&
        first.product !== null &&
        sameProduct(other.product, first.product),
    );
    decisions.set(sku, {
      first,
      identical,
      error: `SKU ${sku} appears on rows ${listRows(group.slice(0, 20))}${group.length > 20 ? ` (additional rows: ${group.length - 20})` : ''} with different values`,
    });
  }
  return rows.map((row) => {
    const decision = decisions.get(normalizedSku(row));
    if (!decision) {
      return row;
    }
    if (decision.identical) {
      return row === decision.first
        ? row
        : {
            ...row,
            status: 'duplicate',
            warnings: [
              ...row.warnings,
              `Same as row ${decision.first.row}, so it was skipped`,
            ],
          };
    }
    return {
      ...row,
      status: 'error',
      product: null,
      errors: [...row.errors, decision.error],
    };
  });
}

function normalizedSku(row: PlannedProductRow): string {
  return row.values.sku.trim().toUpperCase();
}

function sameProduct(a: CreateProductInput, b: CreateProductInput): boolean {
  return (
    a.sku === b.sku &&
    a.name === b.name &&
    a.description === b.description &&
    a.category === b.category &&
    a.priceCents === b.priceCents &&
    a.stock === b.stock &&
    a.weightGrams === b.weightGrams
  );
}

function listRows(group: PlannedProductRow[]): string {
  const numbers = group.map(({ row }) => String(row));
  return numbers.length === 2
    ? numbers.join(' and ')
    : `${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`;
}
