import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { nextDeliveryAfter } from '../../delivery-schedule.js';
import { OutboxEventRepository } from '../../repositories/outbox-event.repository.js';
import { WebhookDeliveryRepository } from '../../repositories/webhook-delivery.repository.js';
import {
  DeliveryAttempt,
  DeliveryOutcome,
  RecordWebhookDeliveryCommand,
} from '../record-webhook-delivery.command.js';

@CommandHandler(RecordWebhookDeliveryCommand)
export class RecordWebhookDeliveryCommandHandler implements ICommandHandler<RecordWebhookDeliveryCommand> {
  constructor(
    private readonly outbox: OutboxEventRepository,
    private readonly deliveries: WebhookDeliveryRepository,
  ) {}

  @Transactional()
  async execute({
    event,
    attempt,
  }: RecordWebhookDeliveryCommand): Promise<DeliveryOutcome> {
    const attempts = event.attempts + 1;

    await this.deliveries.log({
      eventId: event.id,
      attempt: attempts,
      statusCode: attempt.statusCode,
      error: attempt.error,
      durationMs: attempt.durationMs,
    });

    if (isSuccess(attempt)) {
      await this.outbox.markDelivered(event.id, attempts);
      return { kind: 'delivered', attempts };
    }

    const failure =
      attempt.error ?? `the receiver answered ${attempt.statusCode}`;
    const next = nextDeliveryAfter(attempts, new Date());

    if (next.kind === 'dead') {
      await this.outbox.markDead(event.id, attempts, failure);
      return { kind: 'dead', attempts };
    }

    await this.outbox.scheduleRetry(event.id, attempts, next.at, failure);
    return { kind: 'retry', attempts, at: next.at };
  }
}

function isSuccess({ statusCode }: DeliveryAttempt): boolean {
  return statusCode !== null && statusCode >= 200 && statusCode < 300;
}
