import { planIndexChanges } from './product-search-document.js';

const shoes = {
  id: 7,
  sku: 'RS-001',
  name: 'Running Shoes',
  description: 'Light shoes',
  category: 'Footwear',
  priceCents: 8999,
  version: 4,
  createdAt: new Date('2026-10-23T10:00:00.000Z'),
};

describe('planIndexChanges', () => {
  it('indexes each changed product once, at its current version', () => {
    expect(
      planIndexChanges(
        [
          { id: '1', productId: 7, version: 2 },
          { id: '2', productId: 7, version: 3 },
        ],
        [shoes],
      ),
    ).toEqual([
      {
        productId: 7,
        version: 4,
        document: {
          id: 7,
          sku: 'RS-001',
          name: 'Running Shoes',
          description: 'Light shoes',
          category: 'Footwear',
          priceCents: 8999,
          createdAt: '2026-10-23T10:00:00.000Z',
        },
      },
    ]);
  });

  it('deletes a product that no longer exists, with its newest queued version', () => {
    expect(
      planIndexChanges(
        [
          { id: '1', productId: 9, version: 2 },
          { id: '2', productId: 9, version: 5 },
        ],
        [],
      ),
    ).toEqual([{ productId: 9, version: 5, document: null }]);
  });
});
