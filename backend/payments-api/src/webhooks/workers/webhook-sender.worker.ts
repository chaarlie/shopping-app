import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { signatureHeader, signPayload } from '@shop/webhook-signature';
import { IntervalJob } from '../../common/jobs/interval-job.js';
import { Env } from '../../config/env.schema.js';
import { ClaimDueWebhookEventsCommand } from '../commands/claim-due-webhook-events.command.js';
import {
  DeliveryAttempt,
  RecordWebhookDeliveryCommand,
} from '../commands/record-webhook-delivery.command.js';
import { OutboxEventEntity } from '../entities/outbox-event.entity.js';

const BATCH_SIZE = 20;
const INTERVAL_MS = 1000;
const LEASE_MS = 30_000;
const TIMEOUT_MS = 5000;

@Injectable()
export class WebhookSenderWorker extends IntervalJob {
  private readonly url: string;
  private readonly secret: string;

  constructor(
    private readonly commandBus: CommandBus,
    configService: ConfigService<Env, true>,
  ) {
    super(
      configService.get('BACKGROUND_JOBS', { infer: true }) === 'on',
      INTERVAL_MS,
    );
    this.url = configService.get('PAYMENT_WEBHOOK_URL', { infer: true });
    this.secret = configService.get('PAYMENT_WEBHOOK_SECRET', { infer: true });
  }

  async runOnce(): Promise<number> {
    const events = await this.commandBus.execute(
      new ClaimDueWebhookEventsCommand(BATCH_SIZE, LEASE_MS),
    );

    await Promise.all(events.map((event) => this.deliver(event)));

    return events.length;
  }

  private async deliver(event: OutboxEventEntity): Promise<void> {
    const attempt = await this.post(event);
    const outcome = await this.commandBus.execute(
      new RecordWebhookDeliveryCommand(event, attempt),
    );
    const failure = attempt.error ?? `status ${attempt.statusCode}`;

    if (outcome.kind === 'retry') {
      this.logger.warn(
        `Webhook ${event.id} attempt ${outcome.attempts} failed (${failure}). Retrying at ${outcome.at.toISOString()}.`,
      );
    }

    if (outcome.kind === 'dead') {
      this.logger.error(
        `Webhook ${event.id} failed ${outcome.attempts} times (${failure}) and will not be sent again.`,
      );
    }
  }

  private async post(event: OutboxEventEntity): Promise<DeliveryAttempt> {
    const body = JSON.stringify(event.payload);
    const started = Date.now();

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [signatureHeader]: signPayload(body, this.secret),
          'x-event-id': event.id,
          'user-agent': 'payments-api-webhooks',
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await response.body?.cancel();

      return {
        statusCode: response.status,
        error: null,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      return {
        statusCode: null,
        error: describeFailure(error),
        durationMs: Date.now() - started,
      };
    }
  }
}

function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  if (error.name === 'TimeoutError') {
    return `no answer within ${TIMEOUT_MS / 1000} s`;
  }

  const cause = (error.cause as { code?: string } | undefined)?.code;

  return cause ? `${error.message}: ${cause}` : error.message;
}
