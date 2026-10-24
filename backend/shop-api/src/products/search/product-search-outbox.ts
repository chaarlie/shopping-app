import { QueuedProductChange } from './product-search-document.js';

export abstract class ProductSearchOutbox {
  abstract claim(
    limit: number,
    leaseMs: number,
  ): Promise<QueuedProductChange[]>;

  abstract complete(ids: string[]): Promise<void>;

  abstract queueAll(): Promise<number>;
}
