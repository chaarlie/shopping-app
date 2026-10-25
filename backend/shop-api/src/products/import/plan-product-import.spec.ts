import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ValidationError } from '../../common/errors.js';
import { planProductImport, ProductImportPlan } from './plan-product-import.js';

const challengeCsv = readFileSync(
  fileURLToPath(
    new URL('../../../../Code Challenge E-Commerce.csv', import.meta.url),
  ),
  'utf8',
);

const header = 'name,sku,description,category,price,stock,weight_kg';

function rowOf(plan: ProductImportPlan, row: number) {
  const found = plan.rows.find((planned) => planned.row === row);

  if (!found) {
    throw new Error(`Row ${row} is not in the plan`);
  }

  return found;
}

describe('planProductImport with the challenge CSV', () => {
  const plan = planProductImport(challengeCsv);
  const row = (number: number) => rowOf(plan, number);
  const count = (status: string) =>
    plan.rows.filter((planned) => planned.status === status).length;

  it('reads all 97 rows and sets aside the 2 blank ones', () => {
    expect(plan.totalRows).toBe(97);
    expect(plan.blankRows).toBe(2);
    expect(plan.rows).toHaveLength(95);
    expect(plan.ignoredColumns).toEqual([]);
  });

  it('accepts 86 products and rejects 9 rows', () => {
    expect(count('ready')).toBe(86);
    expect(count('error')).toBe(9);
    expect(count('duplicate')).toBe(0);
  });

  it('rejects every row of a SKU that repeats with different values', () => {
    for (const number of [2, 36]) {
      expect(row(number).errors).toEqual([
        'SKU RS-001 appears on rows 2 and 36 with different values',
      ]);
    }

    for (const number of [11, 56, 89]) {
      expect(row(number).errors).toEqual([
        'SKU BS-021 appears on rows 11, 56 and 89 with different values',
      ]);
    }
  });

  it('rejects rows with values it cannot trust', () => {
    expect(row(7).errors).toEqual(['Price "free" is not a valid amount']);
    expect(row(16).errors).toEqual([]);
    expect(row(16).product?.stock).toBe(0);
    expect(row(16).warnings).toContain('-5 → 0 · order at least 5');
    expect(row(25).errors).toEqual(['Name is required']);
    expect(row(41).errors).toEqual(['Name is required']);
    expect(row(47).errors).toEqual(['Price must be greater than 0']);
  });

  it('fixes what it safely can and says what it did', () => {
    expect(row(4).product?.priceCents).toBe(2999);
    expect(row(4).warnings).toEqual([
      'Removed the $ sign from the price "$29.99"',
    ]);

    expect(row(50).product?.weightGrams).toBeNull();
    expect(row(50).warnings).toEqual(['Weight is blank, so it was left empty']);

    expect(row(52).product?.category).toBe('Uncategorized');
    expect(row(52).warnings).toEqual([
      'Category was blank, so it was set to Uncategorized',
    ]);
  });

  it('keeps markup, quotes, commas, SQL and unicode as plain text', () => {
    expect(row(20).product?.name).toBe("<script>alert('xss')</script>");
    expect(row(29).product?.name).toBe("Robert'); DROP TABLE products;--");
    expect(row(53).product?.name).toBe('Comma, In Product Name');
    expect(row(59).product?.name).toBe('Quote "Inside" Name');
    expect(row(31).product?.description).toBe(
      'Stainless steel, 1L — keeps drinks cold for 24hrs™',
    );
  });

  it('converts prices and weights exactly', () => {
    expect(row(3).product).toMatchObject({
      sku: 'CB-010',
      priceCents: 1875,
      stock: 500,
      weightGrams: 1000,
    });
    expect(row(10).product).toMatchObject({
      priceCents: 44999,
      weightGrams: 35000,
    });
    expect(row(9).product?.weightGrams).toBe(40);
  });

  it('treats the same name under another SKU as a different product', () => {
    expect(row(55).product?.sku).toBe('RS-050');
    expect(row(68).product?.sku).toBe('BS-099');
  });

  it('accepts zero stock and zero weight', () => {
    expect(row(51).product?.stock).toBe(0);
    expect(row(52).product).toMatchObject({ stock: 99999, weightGrams: 0 });
  });
});

describe('planProductImport edge cases', () => {
  const plan = (...lines: string[]) =>
    planProductImport([header, ...lines].join('\n'));

  it('skips a row that repeats another one exactly', () => {
    const result = plan(
      'Mug,MG-1,Blue mug,Kitchen,9.99,10,0.3',
      'Mug,mg-1,Blue mug,Kitchen,9.99,10,0.3',
    );

    expect(rowOf(result, 2).status).toBe('ready');
    expect(rowOf(result, 3).status).toBe('duplicate');
    expect(rowOf(result, 3).warnings).toEqual([
      'Same as row 2, so it was skipped',
    ]);
  });

  it('reports every problem in a row, in column order', () => {
    const result = plan(' ,BAD SKU,,Kitchen,abc,-1,heavy');

    expect(rowOf(result, 2).errors).toEqual([
      'Name is required',
      'SKU must be 1 to 32 letters, digits or hyphens',
      'Price "abc" is not a valid amount',
      'Weight "heavy" is not a valid number of kilograms',
    ]);
  });

  it('rejects a row with the wrong number of values', () => {
    const result = plan('Comma, Unquoted,CU-1,Desc,Misc,1.00,1,0.1');

    expect(rowOf(result, 2).errors).toEqual([
      'Expected 7 values but found 8. Check for commas outside quotes.',
    ]);
  });

  it('accepts columns in any order and ignores extra ones', () => {
    const result = planProductImport(
      'sku,colour,weight_kg,stock,price,category,description,name\nMG-1,blue,0.3,10,9.99,Kitchen,Blue mug,Mug',
    );

    expect(result.ignoredColumns).toEqual(['colour']);
    expect(rowOf(result, 2).product).toMatchObject({
      sku: 'MG-1',
      name: 'Mug',
    });
  });

  it('reads a file that starts with a byte order mark', () => {
    const result = planProductImport(
      `﻿${header}\nMug,MG-1,Blue mug,Kitchen,9.99,10,0.3`,
    );

    expect(rowOf(result, 2).status).toBe('ready');
  });

  it('rejects a file without the expected columns', () => {
    expect(() => planProductImport('name,sku\nMug,MG-1')).toThrow(
      new ValidationError(
        'The file is missing these columns: description, category, price, stock, weight_kg',
      ),
    );
  });

  it('rejects a file that is not valid CSV', () => {
    expect(() => plan('"Mug,MG-1,Blue mug,Kitchen,9.99,10,0.3')).toThrow(
      /^The file is not valid CSV/,
    );
  });

  it('rejects an empty file', () => {
    expect(() => planProductImport('')).toThrow('The file is empty');
  });
});
