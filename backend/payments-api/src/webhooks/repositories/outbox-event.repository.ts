import type { PaymentEvent } from '@shop/contracts';
import { OutboxEventEntity } from '../entities/outbox-event.entity.js';

export abstract class OutboxEventRepository {
  abstract add(event: PaymentEvent): Promise<void>;

  abstract claimDue(
    limit: number,
    leaseMs: number,
  ): Promise<OutboxEventEntity[]>;

  abstract markDelivered(id: string, attempts: number): Promise<void>;

  abstract scheduleRetry(
    id: string,
    attempts: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void>;

  abstract markDead(id: string, attempts: number, error: string): Promise<void>;
}
