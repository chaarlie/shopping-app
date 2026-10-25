import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { QueuedProductChange } from './product-search-document.js';
import { ProductSearchOutbox } from './product-search-outbox.js';

interface OutboxRow {
  id: string;
  product_id: number;
  version: number;
}

@Injectable()
export class TypeOrmProductSearchOutbox implements ProductSearchOutbox {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async claim(limit: number, leaseMs: number): Promise<QueuedProductChange[]> {
    const rows = await this.txHost.tx.query<OutboxRow[]>(
      `
        SELECT id, product_id, version
        FROM product_search_outbox
        WHERE locked_until IS NULL OR locked_until < now()
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
      [limit],
    );

    if (rows.length === 0) {
      return [];
    }

    await this.txHost.tx.query(
      `
        UPDATE product_search_outbox
        SET locked_until = now() + make_interval(secs => $2)
        WHERE id = ANY($1::bigint[])
      `,
      [rows.map(({ id }) => id), leaseMs / 1000],
    );

    return rows.map(({ id, product_id, version }) => ({
      id,
      productId: product_id,
      version,
    }));
  }

  async complete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.txHost.tx.query(
      'DELETE FROM product_search_outbox WHERE id = ANY($1::bigint[])',
      [ids],
    );
  }

  async queueAll(): Promise<number> {
    const [{ count }] = await this.txHost.tx.query<{ count: number }[]>(`
      WITH queued AS (
        INSERT INTO product_search_outbox (product_id, version)
        SELECT id, version FROM products
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM queued
    `);

    return count;
  }
}
