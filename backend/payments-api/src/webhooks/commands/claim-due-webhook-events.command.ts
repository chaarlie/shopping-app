import { Command } from '@nestjs/cqrs';
import { OutboxEventEntity } from '../entities/outbox-event.entity.js';

export class ClaimDueWebhookEventsCommand extends Command<OutboxEventEntity[]> {
  constructor(
    public readonly limit: number,
    public readonly leaseMs: number,
  ) {
    super();
  }
}
