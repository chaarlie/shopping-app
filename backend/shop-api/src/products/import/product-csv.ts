import { productCsvColumns, ProductCsvColumn } from '@shop/contracts';
import { parse } from 'csv-parse/sync';
import { ValidationError } from '../../common/errors.js';

export type ProductCsvValues = Record<ProductCsvColumn, string>;

export interface ProductCsvRecord {
  row: number;
  cellCount: number;
  values: ProductCsvValues;
}

export interface ProductCsv {
  columnCount: number;
  ignoredColumns: string[];
  records: ProductCsvRecord[];
}

export function parseProductCsv(text: string, maxRows = 20_000): ProductCsv {
  const [header, ...data] = readRecords(text, maxRows);

  if (!header) {
    throw new ValidationError('The file is empty');
  }

  const columns = header.map((column) => column.trim().toLowerCase());
  const missing = productCsvColumns.filter(
    (column) => !columns.includes(column),
  );

  if (missing.length > 0) {
    throw new ValidationError(
      `The file is missing these columns: ${missing.join(', ')}`,
    );
  }

  return {
    columnCount: columns.length,
    ignoredColumns: columns.filter(
      (column) => !(productCsvColumns as readonly string[]).includes(column),
    ),
    records: data.map((cells, index) => ({
      row: index + 2,
      cellCount: cells.length,
      values: Object.fromEntries(
        productCsvColumns.map((column) => [
          column,
          cells[columns.indexOf(column)] ?? '',
        ]),
      ) as ProductCsvValues,
    })),
  };
}

function readRecords(text: string, maxRows: number): string[][] {
  try {
    return parse(text, {
      bom: true,
      max_record_size: 100_000,
      on_record: (record: string[], context) => {
        if (context.records > maxRows + 1) {
          throw new ValidationError(`CSV exceeds the ${maxRows} row limit`);
        }
        return record;
      },
      relax_column_count: true,
      skip_empty_lines: false,
    });
  } catch (error) {
    throw new ValidationError(
      `The file is not valid CSV: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
