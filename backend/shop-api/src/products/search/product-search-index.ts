import { ProductIndexChange } from './product-search-document.js';

export type IndexWriteOutcome = 'done' | 'failed';

export abstract class ProductSearchIndex {
  abstract currentIndex(): Promise<string | null>;

  abstract createIndex(variant?: string): Promise<string>;

  abstract pointAliasAt(index: string): Promise<string | null>;

  abstract dropIndex(index: string): Promise<void>;

  abstract write(
    changes: ProductIndexChange[],
    index?: string,
  ): Promise<Map<number, IndexWriteOutcome>>;

  abstract refresh(): Promise<void>;
}
