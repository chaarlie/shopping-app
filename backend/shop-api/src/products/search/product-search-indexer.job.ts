import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SearchUnavailableError } from '../../common/errors.js';
import { IntervalJob } from '../../common/jobs/interval-job.js';
import { Env } from '../../config/env.schema.js';
import { ClaimProductSearchChangesCommand } from './commands/claim-product-search-changes.command.js';
import { CompleteProductSearchChangesCommand } from './commands/complete-product-search-changes.command.js';
import { QueueAllProductsForSearchCommand } from './commands/queue-all-products-for-search.command.js';
import { planIndexChanges } from './product-search-document.js';
import { ProductSearchIndex } from './product-search-index.js';
import { FindProductsByIdsQuery } from './queries/find-products-by-ids.query.js';

const INTERVAL_MS = 1000;
const BATCH_SIZE = 500;
const LEASE_MS = 30_000;

@Injectable()
export class ProductSearchIndexerJob extends IntervalJob {
  private indexReady = false;
  private waitingForOpenSearch = false;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly index: ProductSearchIndex,
    configService: ConfigService<Env, true>,
  ) {
    super(
      configService.get('BACKGROUND_JOBS', { infer: true }) === 'on',
      INTERVAL_MS,
    );
  }

  async runOnce(): Promise<number> {
    try {
      const indexed = await this.indexQueuedChanges();

      if (this.waitingForOpenSearch) {
        this.logger.log('OpenSearch is reachable again');
        this.waitingForOpenSearch = false;
      }

      return indexed;
    } catch (error) {
      if (!(error instanceof SearchUnavailableError)) {
        throw error;
      }

      if (!this.waitingForOpenSearch) {
        this.logger.warn(
          'Search index updates are waiting for OpenSearch to come back',
        );
        this.waitingForOpenSearch = true;
      }

      return 0;
    }
  }

  private async indexQueuedChanges(): Promise<number> {
    await this.ensureIndex();

    const queued = await this.commandBus.execute(
      new ClaimProductSearchChangesCommand(BATCH_SIZE, LEASE_MS),
    );

    if (queued.length === 0) {
      return 0;
    }

    const products = await this.queryBus.execute(
      new FindProductsByIdsQuery([
        ...new Set(queued.map(({ productId }) => productId)),
      ]),
    );
    const outcomes = await this.index.write(planIndexChanges(queued, products));
    const done = queued
      .filter(({ productId }) => outcomes.get(productId) === 'done')
      .map(({ id }) => id);

    await this.commandBus.execute(
      new CompleteProductSearchChangesCommand(done),
    );

    if (done.length < queued.length) {
      this.indexReady = false;
      this.logger.warn(
        `${queued.length - done.length} search index changes failed and will be retried`,
      );
    }

    return done.length;
  }

  private async ensureIndex(): Promise<void> {
    if (this.indexReady) {
      return;
    }

    if (!(await this.index.currentIndex())) {
      const index = await this.index.createIndex();
      await this.index.pointAliasAt(index);
      const queued = await this.commandBus.execute(
        new QueueAllProductsForSearchCommand(),
      );
      this.logger.log(
        `Created the search index ${index} and queued ${queued} products for it`,
      );
    }

    this.indexReady = true;
  }
}
