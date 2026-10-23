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

  async claimDue(limit: number, leaseMs: number): Promise<OutboxEventEntity[]> {
    const now = new Date();
    const due = await this.repository
      .createQueryBuilder('event')
      .where('event.deliveredAt IS NULL')
      .andWhere('event.deadAt IS NULL')
      .andWhere('event.nextAttemptAt <= :now', { now })
      .andWhere('(event.lockedUntil IS NULL OR event.lockedUntil < :now)', {
        now,
      })
      .orderBy('event.nextAttemptAt', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();

    if (due.length === 0) {
      return [];
    }

    const lockedUntil = new Date(now.getTime() + leaseMs);
    await this.repository.update(
      due.map((event) => event.id),
      { lockedUntil },
    );

    for (const event of due) {
      event.lockedUntil = lockedUntil;
    }

    return due;
  }

  async markDelivered(id: string, attempts: number): Promise<void> {
    await this.repository.update(id, {
      attempts,
      deliveredAt: new Date(),
      lockedUntil: null,
      lastError: null,
    });
  }

  async scheduleRetry(
    id: string,
    attempts: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void> {
    await this.repository.update(id, {
      attempts,
      nextAttemptAt,
      lockedUntil: null,
      lastError: error,
    });
  }

  async markDead(id: string, attempts: number, error: string): Promise<void> {
    await this.repository.update(id, {
      attempts,
      deadAt: new Date(),
      lockedUntil: null,
      lastError: error,
    });
  }
}
