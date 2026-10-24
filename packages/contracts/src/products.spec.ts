import {
  createProductSchema,
  productListQuerySchema,
  productSearchQuerySchema,
  updateProductSchema,
} from './products.js';

describe('productSearchQuerySchema', () => {
  it('refuses a sort it does not know', () => {
    expect(
      productSearchQuerySchema.safeParse({ sort: 'popularity' }).success,
    ).toBe(false);
  });
});

const validProduct = {
  sku: 'rs-001',
  name: '  Running Shoes ',
  category: 'Footwear',
  priceCents: 8999,
  stock: 150,
};

describe('createProductSchema', () => {
  it('normalizes the SKU and trims text', () => {
    expect(createProductSchema.parse(validProduct)).toEqual({
      sku: 'RS-001',
      name: 'Running Shoes',
      description: '',
      category: 'Footwear',
      priceCents: 8999,
      stock: 150,
      weightGrams: null,
    });
  });

  it('rejects unknown fields', () => {
    expect(
      createProductSchema.safeParse({ ...validProduct, id: 7 }).success,
    ).toBe(false);
  });

  it('rejects a name that is only whitespace', () => {
    expect(
      createProductSchema.safeParse({ ...validProduct, name: '     ' }).success,
    ).toBe(false);
  });

  it('rejects negative stock and a zero price', () => {
    expect(
      createProductSchema.safeParse({ ...validProduct, stock: -5 }).success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({ ...validProduct, priceCents: 0 }).success,
    ).toBe(false);
  });

  it('rejects a SKU with spaces', () => {
    expect(
      createProductSchema.safeParse({ ...validProduct, sku: 'RS 001' }).success,
    ).toBe(false);
  });
});

describe('updateProductSchema', () => {
  it('leaves out fields that were not sent', () => {
    expect(updateProductSchema.parse({ stock: 3, version: 2 })).toEqual({
      stock: 3,
      version: 2,
    });
  });

  it('requires the version the client last saw', () => {
    expect(updateProductSchema.safeParse({ stock: 3 }).success).toBe(false);
  });

  it('does not allow changing the SKU', () => {
    expect(
      updateProductSchema.safeParse({ sku: 'NEW-1', version: 1 }).success,
    ).toBe(false);
  });
});

describe('productListQuerySchema', () => {
  it('reads paging values from query strings', () => {
    expect(productListQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual(
      { page: 2, pageSize: 50 },
    );
  });

  it('caps the page size', () => {
    expect(productListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(
      false,
    );
  });
});
