import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { PaymentEvent } from '@shop/contracts';
import { Repository } from 'typeorm';
import {
  PaymentEventOutcome,
  ProcessedPaymentEventEntity,
} from '../entities/processed-payment-event.entity.js';
import { ProcessedPaymentEventRepository } from './processed-payment-event.repository.js';

@Injectable()
export class TypeOrmProcessedPaymentEventRepository implements ProcessedPaymentEventRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get repository(): Repository<ProcessedPaymentEventEntity> {
    return this.txHost.tx.getRepository(ProcessedPaymentEventEntity);
  }

  async recordIfNew(event: PaymentEvent): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(ProcessedPaymentEventEntity)
      .values({
        eventId: event.id,
        type: event.type,
        orderReference: event.data.orderReference,
        outcome: 'received',
      })
      .orIgnore()
      .returning('event_id')
      .execute();

    return (result.raw as unknown[]).length === 1;
  }

  async settle(
    eventId: string,
    outcome: Exclude<PaymentEventOutcome, 'received'>,
    detail: string | null,
  ): Promise<void> {
    await this.repository.update(eventId, { outcome, detail });
  }
}
