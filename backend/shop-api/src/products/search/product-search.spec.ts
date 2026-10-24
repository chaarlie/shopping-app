import { planIndexChanges } from './product-search-document.js';
import { buildProductSearchRequest } from './product-search-request.js';

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

describe('buildProductSearchRequest', () => {
  it('pages from the requested page and asks only for ids', () => {
    expect(
      buildProductSearchRequest({ q: 'shoes', page: 3, pageSize: 20 }),
    ).toMatchObject({ from: 40, size: 20, _source: false });
  });

  it('ranks an exact SKU above everything else, ignoring case', () => {
    const request = buildProductSearchRequest({
      q: 'RS-001',
      page: 1,
      pageSize: 20,
    });

    expect(JSON.stringify(request.query)).toContain(
      '{"term":{"sku":{"value":"rs-001","boost":20}}}',
    );
  });

  const wordsClause = (q: string) =>
    (
      buildProductSearchRequest({ q, page: 1, pageSize: 20 }).query as {
        bool: {
          should: {
            bool?: { should: unknown[]; minimum_should_match: string };
          }[];
        };
      }
    ).bool.should.find((clause) => clause.bool)?.bool;

  it('needs every word of a short search and three in four of a longer one', () => {
    expect(wordsClause('black wireless charging pad')).toMatchObject({
      minimum_should_match: '2<75%',
    });
    expect(wordsClause('black wireless charging pad')?.should).toHaveLength(4);
  });

  it('ignores words with no letters or digits', () => {
    expect(wordsClause('shoes ! --')?.should).toHaveLength(1);
    expect(wordsClause('%')).toBeUndefined();
  });

  it('filters by category without affecting the score', () => {
    const request = buildProductSearchRequest({
      q: 'shoes',
      category: 'Footwear',
      page: 1,
      pageSize: 20,
    });

    expect(request.query).toMatchObject({
      bool: { filter: [{ term: { category: 'Footwear' } }] },
    });
  });

  it('sorts by relevance when there is search text, and by name otherwise', () => {
    expect(
      buildProductSearchRequest({ q: 'shoes', page: 1, pageSize: 20 }).sort,
    ).toEqual(['_score', { 'name.sortable': 'asc' }, { id: 'asc' }]);
    expect(buildProductSearchRequest({ page: 1, pageSize: 20 }).sort).toEqual([
      { 'name.sortable': 'asc' },
      { id: 'asc' },
    ]);
  });

  it('breaks price ties by id so pages never repeat a product', () => {
    expect(
      buildProductSearchRequest({
        q: 'shoes',
        sort: 'price_desc',
        page: 1,
        pageSize: 20,
      }).sort,
    ).toEqual([{ priceCents: 'desc' }, { id: 'asc' }]);
  });
});

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
