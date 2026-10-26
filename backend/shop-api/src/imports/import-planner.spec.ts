import { planStoredRows } from './import-planner.js';
import type { StoredRow } from './repositories/import.repository.js';
import type { ProductCsvValues } from '../products/import/product-csv.js';
const values: ProductCsvValues = {
  name: 'Mug',
  sku: 'MG-1',
  description: 'Blue mug',
  category: 'Kitchen',
  price: '9.99',
  stock: '10',
  weight_kg: '0.3',
};
function stored(
  row: number,
  overrides: Partial<ProductCsvValues> = {},
  options: Partial<StoredRow> = {},
): StoredRow {
  const cells = { ...values, ...overrides };
  return {
    row_number: row,
    values: cells,
    original_errors: [],
    excluded: false,
    edited_by: null,
    edited_at: null,
    editor: null,
    result: {
      row,
      values: cells,
      status: 'create',
      errors: [],
      warnings: [],
      changes: [],
      excluded: false,
      editedBy: null,
      editedAt: null,
    },
    ...options,
  };
}
const empty: ProductCsvValues = {
  name: '',
  sku: '',
  description: '',
  category: '',
  price: '',
  stock: '',
  weight_kg: '',
};
describe('stored import row identity', () => {
  it('keeps invalid and valid results on their original rows after an emptied row', () => {
    const plan = planStoredRows(
      [
        stored(2, empty, { edited_at: new Date() }),
        stored(5, { sku: 'BAD', price: 'abc' }),
        stored(9, { sku: 'GOOD' }),
      ],
      [],
      false,
    );
    expect(plan.results.map(({ row, status }) => ({ row, status }))).toEqual([
      { row: 2, status: 'error' },
      { row: 5, status: 'error' },
      { row: 9, status: 'create' },
    ]);
    expect(plan.results[1].errors.join(' ')).toContain('abc');
    expect(
      plan.matched
        .filter((row) => row.status === 'create')
        .map((row) => row.product?.sku),
    ).toEqual(['GOOD']);
  });
  it('never clears an untouched quarantined row’s original error after a blank row', () => {
    const plan = planStoredRows(
      [
        stored(2, empty, { edited_at: new Date() }),
        stored(
          7,
          { sku: 'QUARANTINED' },
          { original_errors: ['Malformed original record'] },
        ),
        stored(8, { sku: 'VALID' }),
      ],
      [],
      false,
    );
    expect(plan.results[1]).toMatchObject({
      row: 7,
      status: 'error',
      errors: ['Malformed original record'],
    });
    expect(plan.matched.find((row) => row.row === 7)?.product).toBeNull();
    expect(plan.results[2].status).toBe('create');
    expect(
      plan.matched
        .filter((row) => row.status === 'create')
        .map((row) => row.product?.sku),
    ).toEqual(['VALID']);
  });
  it('remaps duplicate references across blanks, exclusions and multiline values', () => {
    const plan = planStoredRows(
      [
        stored(2, {}, { excluded: true }),
        stored(4, empty, { edited_at: new Date() }),
        stored(8, { description: 'Two\nlines' }),
        stored(12, { price: '12.00' }),
      ],
      [],
      false,
    );
    expect(plan.results[0].status).toBe('excluded');
    for (const row of plan.results.slice(2)) {
      expect(row.status).toBe('error');
      expect(row.errors.join(' ')).toContain('rows 8 and 12');
    }
  });
});
