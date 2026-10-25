import { describe, it, expect } from 'vitest';
import { decimalUnits, productFromForm } from './product-form';
describe('product form amounts', () => {
  it('converts decimal money and kilograms without floating point rounding', () => {
    expect(decimalUnits('29.99', 2)).toBe(2999);
    expect(decimalUnits('0.001', 3)).toBe(1);
    expect(decimalUnits('1', 2)).toBe(100);
  });
  it('rejects rounding, exponent notation, negative values and blank prices', () => {
    for (const raw of ['1.999', '1e3', '-1', '']) {
      expect(() => decimalUnits(raw, 2)).toThrow();
    }
  });
  it('keeps the original version and omits immutable SKU for updates', () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      sku: 'CHANGED',
      name: 'Mug',
      category: 'Kitchen',
      price: '9.99',
      stock: '0',
    })) {
      form.set(key, value);
    }
    expect(productFromForm(form, 7)).toEqual({
      name: 'Mug',
      description: '',
      category: 'Kitchen',
      priceCents: 999,
      stock: 0,
      weightGrams: null,
      version: 7,
    });
  });
});
