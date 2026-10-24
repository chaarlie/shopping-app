import type { API } from '@opensearch-project/opensearch';

export const productIndexDefinitionVersion = 1;

export const productIndexDefinition: API.Indices_Create_RequestBody = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      filter: {
        word_start: { type: 'edge_ngram', min_gram: 2, max_gram: 20 },
      },
      analyzer: {
        word_starts: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'word_start'],
        },
        words: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
      normalizer: {
        folded: {
          type: 'custom',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    dynamic: 'strict',
    _meta: { definitionVersion: productIndexDefinitionVersion },
    properties: {
      id: { type: 'integer' },
      sku: { type: 'keyword', normalizer: 'folded' },
      name: {
        type: 'text',
        analyzer: 'word_starts',
        search_analyzer: 'words',
        fields: {
          words: { type: 'text', analyzer: 'words' },
          sortable: { type: 'keyword', normalizer: 'folded' },
        },
      },
      description: { type: 'text', analyzer: 'words' },
      category: { type: 'keyword' },
      priceCents: { type: 'long' },
      createdAt: { type: 'date' },
    },
  },
};
