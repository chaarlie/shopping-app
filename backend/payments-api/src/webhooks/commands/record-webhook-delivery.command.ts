import { Command } from '@nestjs/cqrs';
import { OutboxEventEntity } from '../entities/outbox-event.entity.js';

export interface DeliveryAttempt {
  statusCode: number | null;
  error: string | null;
  durationMs: number;
}

export type DeliveryOutcome =
  | { kind: 'delivered'; attempts: number }
  | { kind: 'retry'; attempts: number; at: Date }
  | { kind: 'dead'; attempts: number };

export class RecordWebhookDeliveryCommand extends Command<DeliveryOutcome> {
  constructor(
    public readonly event: OutboxEventEntity,
    public readonly attempt: DeliveryAttempt,
  ) {
    super();
  }
}
