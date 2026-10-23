import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

export const ORDER_UPDATES_CHANNEL = 'order_updates';

@Injectable()
export class OrderUpdatesPublisher {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async publish(reference: string): Promise<void> {
    await this.txHost.tx.query('SELECT pg_notify($1, $2)', [
      ORDER_UPDATES_CHANNEL,
      reference,
    ]);
  }
}
