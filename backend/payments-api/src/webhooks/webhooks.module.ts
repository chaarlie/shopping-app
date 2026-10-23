import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaimDueWebhookEventsCommandHandler } from './commands/handlers/claim-due-webhook-events-command.handler.js';
import { RecordWebhookDeliveryCommandHandler } from './commands/handlers/record-webhook-delivery-command.handler.js';
import { OutboxEventEntity } from './entities/outbox-event.entity.js';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity.js';
import { OutboxEventRepository } from './repositories/outbox-event.repository.js';
import { TypeOrmOutboxEventRepository } from './repositories/typeorm-outbox-event.repository.js';
import { TypeOrmWebhookDeliveryRepository } from './repositories/typeorm-webhook-delivery.repository.js';
import { WebhookDeliveryRepository } from './repositories/webhook-delivery.repository.js';
import { WebhookSenderWorker } from './workers/webhook-sender.worker.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEventEntity, WebhookDeliveryEntity]),
  ],
  providers: [
    {
      provide: OutboxEventRepository,
      useClass: TypeOrmOutboxEventRepository,
    },
    {
      provide: WebhookDeliveryRepository,
      useClass: TypeOrmWebhookDeliveryRepository,
    },
    ClaimDueWebhookEventsCommandHandler,
    RecordWebhookDeliveryCommandHandler,
    WebhookSenderWorker,
  ],
  exports: [OutboxEventRepository],
})
export class WebhooksModule {}
