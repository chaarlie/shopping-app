import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, errors, type API } from '@opensearch-project/opensearch';
import type { ProductSearchQuery } from '@shop/contracts';
import { SearchUnavailableError } from '../../common/errors.js';
import { Env } from '../../config/env.schema.js';
import {
  productIndexDefinition,
  productIndexDefinitionVersion,
} from './product-index.definition.js';
import { ProductIndexChange } from './product-search-document.js';
import {
  IndexWriteOutcome,
  ProductSearchHits,
  ProductSearchIndex,
} from './product-search-index.js';
import { buildProductSearchRequest } from './product-search-request.js';

interface BulkItemResult {
  status: number;
}

type BulkItem = Partial<Record<'index' | 'delete', BulkItemResult>>;

interface SearchHitsBody {
  hits: {
    total?: number | { value: number };
    hits: { _id: string }[];
  };
}

@Injectable()
export class OpenSearchProductSearchIndex implements ProductSearchIndex {
  private readonly alias: string;

  constructor(
    private readonly client: Client,
    configService: ConfigService<Env, true>,
  ) {
    this.alias = configService.get('OPENSEARCH_INDEX', { infer: true });
  }

  async currentIndex(): Promise<string | null> {
    const response = await this.call(() =>
      this.client.indices.getAlias({ name: this.alias }, { ignore: [404] }),
    );

    if (response.statusCode === 404) {
      return null;
    }

    return Object.keys(response.body as Record<string, unknown>)[0] ?? null;
  }

  async createIndex(variant?: string): Promise<string> {
    const index = [this.alias, `v${productIndexDefinitionVersion}`, variant]
      .filter(Boolean)
      .join('-');
    const response = await this.call(() =>
      this.client.indices.create(
        { index, body: productIndexDefinition },
        { ignore: [400] },
      ),
    );
    const errorType = (response.body as { error?: { type?: string } }).error
      ?.type;

    if (errorType && errorType !== 'resource_already_exists_exception') {
      throw new Error(`OpenSearch refused to create ${index}: ${errorType}`);
    }

    return index;
  }

  async pointAliasAt(index: string): Promise<string | null> {
    const previous = await this.currentIndex();

    if (previous === index) {
      return previous;
    }

    const actions = [
      { add: { index, alias: this.alias } },
      ...(previous ? [{ remove: { index: previous, alias: this.alias } }] : []),
    ];
    await this.call(() =>
      this.client.indices.updateAliases({ body: { actions } }),
    );

    return previous;
  }

  async dropIndex(index: string): Promise<void> {
    await this.call(() =>
      this.client.indices.delete({ index }, { ignore: [404] }),
    );
  }

  async write(
    changes: ProductIndexChange[],
    index: string = this.alias,
  ): Promise<Map<number, IndexWriteOutcome>> {
    if (changes.length === 0) {
      return new Map();
    }

    const body: API.Bulk_RequestBody = changes.flatMap(
      ({ productId, version, document }): Record<string, unknown>[] => {
        const target = {
          _index: index,
          _id: String(productId),
          version,
          version_type: 'external',
        };

        return document
          ? [{ index: target }, { ...document }]
          : [{ delete: target }];
      },
    );
    const response = await this.call(() =>
      this.client.bulk({ body, require_alias: index === this.alias }),
    );
    const items = (response.body as { items: BulkItem[] }).items;

    return new Map(
      changes.map((change, position) => [
        change.productId,
        outcomeOf(items[position]),
      ]),
    );
  }

  async search(query: ProductSearchQuery): Promise<ProductSearchHits> {
    const response = await this.call(() =>
      this.client.search(
        { index: this.alias, body: buildProductSearchRequest(query) },
        { ignore: [404] },
      ),
    );

    if (response.statusCode === 404) {
      throw new SearchUnavailableError(
        'Search is still being set up. Browse by category instead.',
      );
    }

    const { hits } = response.body as SearchHitsBody;
    const total =
      typeof hits.total === 'number' ? hits.total : (hits.total?.value ?? 0);

    return { ids: hits.hits.map((hit) => Number(hit._id)), total };
  }

  async refresh(): Promise<void> {
    await this.call(() => this.client.indices.refresh({ index: this.alias }));
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      if (
        error instanceof errors.ConnectionError ||
        error instanceof errors.TimeoutError ||
        error instanceof errors.NoLivingConnectionsError
      ) {
        throw new SearchUnavailableError(
          'Search is unavailable right now. Browse by category instead.',
        );
      }

      throw error;
    }
  }
}

function outcomeOf(item: BulkItem | undefined): IndexWriteOutcome {
  const result = item?.index ?? item?.delete;

  if (!result) {
    return 'failed';
  }

  const applied = result.status >= 200 && result.status < 300;
  const alreadyNewer = result.status === 409;
  const alreadyGone = item?.delete !== undefined && result.status === 404;

  return applied || alreadyNewer || alreadyGone ? 'done' : 'failed';
}
