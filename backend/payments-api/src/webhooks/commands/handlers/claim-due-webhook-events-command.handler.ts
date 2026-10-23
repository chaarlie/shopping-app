import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxEventEntity } from '../../entities/outbox-event.entity.js';
import { OutboxEventRepository } from '../../repositories/outbox-event.repository.js';
import { ClaimDueWebhookEventsCommand } from '../claim-due-webhook-events.command.js';

@CommandHandler(ClaimDueWebhookEventsCommand)
export class ClaimDueWebhookEventsCommandHandler implements ICommandHandler<ClaimDueWebhookEventsCommand> {
  constructor(private readonly outbox: OutboxEventRepository) {}

  @Transactional()
  execute({
    limit,
    leaseMs,
  }: ClaimDueWebhookEventsCommand): Promise<OutboxEventEntity[]> {
    return this.outbox.claimDue(limit, leaseMs);
  }
}
