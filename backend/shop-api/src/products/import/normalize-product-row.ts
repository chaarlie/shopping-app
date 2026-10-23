import {
  CreateProductInput,
  createProductSchema,
  productCsvColumns,
} from '@shop/contracts';
import { ProductCsvValues } from './product-csv.js';

export interface NormalizedProductRow {
  product: CreateProductInput | null;
  errors: string[];
  warnings: string[];
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

type ProductField = keyof CreateProductInput;

const AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;
const WHOLE_NUMBER = /^-?\d+$/;
const KILOGRAMS = /^(\d+)(?:\.(\d{1,3}))?$/;

const fieldColumns: Record<ProductField, string> = {
  name: 'name',
  sku: 'sku',
  description: 'description',
  category: 'category',
  priceCents: 'price',
  stock: 'stock',
  weightGrams: 'weight_kg',
};

const columnOrder = (field: ProductField) =>
  (productCsvColumns as readonly string[]).indexOf(fieldColumns[field]);

export function normalizeProductRow(
  values: ProductCsvValues,
): NormalizedProductRow {
  const warnings: string[] = [];
  const problems: { field: ProductField; message: string }[] = [];

  const category = values.category.trim();
  if (category === '') {
    warnings.push('Category was blank, so it was set to Uncategorized');
  }

  const priceCents = parsePriceCents(values.price, warnings);
  const stock = parseStock(values.stock);
  const weightGrams = parseWeightGrams(values.weight_kg, warnings);

  const parsedFields = { priceCents, stock, weightGrams };
  for (const [field, parsed] of Object.entries(parsedFields)) {
    if (!parsed.ok) {
      problems.push({ field: field as ProductField, message: parsed.error });
    }
  }

  const result = createProductSchema.safeParse({
    sku: values.sku,
    name: values.name,
    description: values.description,
    category: category === '' ? 'Uncategorized' : category,
    priceCents: priceCents.ok ? priceCents.value : undefined,
    stock: stock.ok ? stock.value : undefined,
    weightGrams: weightGrams.ok ? weightGrams.value : undefined,
  });

  if (!result.success) {
    const fieldsWithProblems = new Set(problems.map(({ field }) => field));

    for (const issue of result.error.issues) {
      const field = String(issue.path[0]) as ProductField;
      if (!fieldsWithProblems.has(field)) {
        problems.push({ field, message: issue.message });
      }
    }
  }

  if (problems.length > 0 || !result.success) {
    return {
      product: null,
      errors: problems
        .sort((a, b) => columnOrder(a.field) - columnOrder(b.field))
        .map(({ message }) => message),
      warnings,
    };
  }

  return { product: result.data, errors: [], warnings };
}

function parsePriceCents(raw: string, warnings: string[]): Parsed<number> {
  const original = raw.trim();
  let text = original;

  if (text === '') {
    return { ok: false, error: 'Price is required' };
  }

  if (text.startsWith('$')) {
    text = text.slice(1).trim();
    warnings.push(`Removed the $ sign from the price "${original}"`);
  }

  const match = AMOUNT.exec(text);
  if (!match) {
    return { ok: false, error: `Price "${original}" is not a valid amount` };
  }

  const [, whole, fraction = ''] = match;
  return {
    ok: true,
    value: Number(whole) * 100 + Number(fraction.padEnd(2, '0')),
  };
}

function parseStock(raw: string): Parsed<number> {
  const text = raw.trim();

  if (text === '') {
    return { ok: false, error: 'Stock is required' };
  }

  if (!WHOLE_NUMBER.test(text)) {
    return { ok: false, error: `Stock "${text}" is not a whole number` };
  }

  return { ok: true, value: Number(text) };
}

function parseWeightGrams(
  raw: string,
  warnings: string[],
): Parsed<number | null> {
  const text = raw.trim();

  if (text === '') {
    warnings.push('Weight is blank, so it was left empty');
    return { ok: true, value: null };
  }

  const match = KILOGRAMS.exec(text);
  if (!match) {
    return {
      ok: false,
      error: `Weight "${text}" is not a valid number of kilograms`,
    };
  }

  const [, whole, fraction = ''] = match;
  return {
    ok: true,
    value: Number(whole) * 1000 + Number(fraction.padEnd(3, '0')),
  };
}
