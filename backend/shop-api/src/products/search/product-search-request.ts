import type { API } from '@opensearch-project/opensearch';
import type { ProductSearchQuery, ProductSort } from '@shop/contracts';

type SortClause = Record<string, 'asc' | 'desc'> | '_score';

const sorts: Record<ProductSort, SortClause[]> = {
  relevance: ['_score', { 'name.sortable': 'asc' }, { id: 'asc' }],
  name: [{ 'name.sortable': 'asc' }, { id: 'asc' }],
  price_asc: [{ priceCents: 'asc' }, { id: 'asc' }],
  price_desc: [{ priceCents: 'desc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
};

export function buildProductSearchRequest({
  q,
  category,
  sort,
  page,
  pageSize,
}: ProductSearchQuery): API.Search_RequestBody {
  const filter = category ? [{ term: { category } }] : [];

  return {
    from: (page - 1) * pageSize,
    size: pageSize,
    track_total_hits: true,
    _source: false,
    query: q ? matching(q, filter) : { bool: { filter } },
    sort: sorts[sort ?? (q ? 'relevance' : 'name')],
  } as API.Search_RequestBody;
}

function matching(q: string, filter: object[]) {
  const folded = q.toLowerCase();
  const words = q.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));

  return {
    bool: {
      filter,
      should: [
        { term: { sku: { value: folded, boost: 20 } } },
        { prefix: { sku: { value: folded, boost: 5 } } },
        { match_phrase_prefix: { 'name.words': { query: q, boost: 6 } } },
        ...(words.length > 0
          ? [
              {
                bool: {
                  should: words.map(wordMatch),
                  minimum_should_match: '2<75%',
                },
              },
            ]
          : []),
      ],
      minimum_should_match: 1,
    },
  };
}

function wordMatch(word: string) {
  return {
    dis_max: {
      queries: [
        { match: { name: { query: word, operator: 'and', boost: 3 } } },
        {
          match: {
            'name.words': {
              query: word,
              operator: 'and',
              fuzziness: 'AUTO:4,8',
              prefix_length: 1,
            },
          },
        },
        {
          match: {
            description: { query: word, operator: 'and', boost: 0.5 },
          },
        },
      ],
    },
  };
}
