import { describe, it, expect } from 'vitest';
import { parseCart } from './cart';
describe('persisted carts', () => {
  it('rejects corrupt or invalid browser data', () => {
    for (const raw of [
      'oops',
      'null',
      '[{"productId":1,"quantity":-1}]',
      '[{"productId":1,"quantity":101}]',
    ]) {
      expect(parseCart(raw)).toEqual([]);
    }
  });
  it('never sends duplicate product IDs to checkout', () => {
    expect(
      parseCart('[{"productId":1,"quantity":2},{"productId":1,"quantity":3}]'),
    ).toEqual([{ productId: 1, quantity: 2 }]);
  });
});
