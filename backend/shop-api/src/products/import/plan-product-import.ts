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

export function planProductImport(csv: string): ProductImportPlan {
  const { columnCount, ignoredColumns, records } = parseProductCsv(csv);
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
      rowsBySku.set(sku, [...(rowsBySku.get(sku) ?? []), row]);
    }
  }

  return rows.map((row) => {
    const sku = normalizedSku(row);
    const group = rowsBySku.get(sku) ?? [];
    const [first] = group;

    if (group.length < 2 || !first) {
      return row;
    }

    const identical = group.every(
      (other) =>
        other.product !== null &&
        first.product !== null &&
        sameProduct(other.product, first.product),
    );

    if (identical) {
      return row === first
        ? row
        : {
            ...row,
            status: 'duplicate',
            warnings: [
              ...row.warnings,
              `Same as row ${first.row}, so it was skipped`,
            ],
          };
    }

    return {
      ...row,
      status: 'error',
      product: null,
      errors: [
        ...row.errors,
        `SKU ${sku} appears on rows ${listRows(group)} with different values`,
      ],
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
