import { CreateProductInput } from '@shop/contracts';
import {
  ExistingProduct,
  matchExistingProducts,
} from './match-existing-products.js';
import { PlannedProductRow } from './plan-product-import.js';

const mug: CreateProductInput = {
  sku: 'MG-1',
  name: 'Mug',
  description: 'Blue mug',
  category: 'Kitchen',
  priceCents: 999,
  stock: 10,
  weightGrams: 300,
};

const planned = (product: CreateProductInput | null): PlannedProductRow => ({
  row: 2,
  status: product ? 'ready' : 'error',
  values: {
    name: '',
    sku: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    weight_kg: '',
  },
  product,
  errors: product ? [] : ['Name is required'],
  warnings: [],
});

const existing = (changes: Partial<ExistingProduct> = {}) =>
  new Map([['MG-1', { ...mug, id: 7, ...changes }]]);

describe('matchExistingProducts', () => {
  it('creates a product whose SKU is new', () => {
    const [row] = matchExistingProducts([planned(mug)], new Map(), 'update');

    expect(row).toMatchObject({ status: 'create', existingId: null });
  });

  it('leaves a product alone when nothing changed', () => {
    const [row] = matchExistingProducts([planned(mug)], existing(), 'update');

    expect(row).toMatchObject({ status: 'unchanged', existingId: 7 });
  });

  it('updates a product whose values changed', () => {
    const [row] = matchExistingProducts(
      [planned(mug)],
      existing({ stock: 4 }),
      'update',
    );

    expect(row).toMatchObject({ status: 'update', existingId: 7 });
  });

  it('skips a changed product when asked to keep existing ones', () => {
    const [row] = matchExistingProducts(
      [planned(mug)],
      existing({ stock: 4 }),
      'skip',
    );

    expect(row).toMatchObject({ status: 'skip', existingId: 7 });
  });

  it('keeps rows with errors as errors', () => {
    const [row] = matchExistingProducts([planned(null)], existing(), 'update');

    expect(row).toMatchObject({ status: 'error', existingId: null });
  });
});
