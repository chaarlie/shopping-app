import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { PaymentEvent } from '@shop/contracts';
import { Repository } from 'typeorm';
import { OutboxEventEntity } from '../entities/outbox-event.entity.js';
import { OutboxEventRepository } from './outbox-event.repository.js';

@Injectable()
export class TypeOrmOutboxEventRepository implements OutboxEventRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get repository(): Repository<OutboxEventEntity> {
    return this.txHost.tx.getRepository(OutboxEventEntity);
  }

  async add(event: PaymentEvent): Promise<void> {
    await this.repository.insert({
      id: event.id,
      type: event.type,
      payload: event,
      nextAttemptAt: new Date(),
    });
  }
}
