import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { QueueAllProductsForSearchCommand } from './commands/queue-all-products-for-search.command.js';
import { toSearchDocument } from './product-search-document.js';
import { ProductSearchIndex } from './product-search-index.js';
import { FindProductsAfterQuery } from './queries/find-products-after.query.js';

const BATCH_SIZE = 1000;

export interface RebuiltIndex {
  index: string;
  products: number;
  replaced: string | null;
}

@Injectable()
export class ProductSearchRebuilder {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly index: ProductSearchIndex,
  ) {}

  async rebuild(): Promise<RebuiltIndex> {
    const index = await this.index.createIndex(String(Date.now()));
    let afterId = 0;
    let products = 0;

    for (;;) {
      const batch = await this.queryBus.execute(
        new FindProductsAfterQuery(afterId, BATCH_SIZE),
      );

      if (batch.length === 0) {
        break;
      }

      const outcomes = await this.index.write(
        batch.map((product) => ({
          productId: product.id,
          version: product.version,
          document: toSearchDocument(product),
        })),
        index,
      );
      const failed = [...outcomes.values()].filter(
        (outcome) => outcome === 'failed',
      ).length;

      if (failed > 0) {
        await this.index.dropIndex(index);
        throw new Error(
          `${failed} products could not be written to ${index}, so the rebuild stopped`,
        );
      }

      afterId = batch[batch.length - 1].id;
      products += batch.length;
    }

    const replaced = await this.index.pointAliasAt(index);
    await this.commandBus.execute(new QueueAllProductsForSearchCommand());

    if (replaced) {
      await this.index.dropIndex(replaced);
    }

    return { index, products, replaced };
  }
}
