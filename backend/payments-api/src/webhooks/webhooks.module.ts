import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEventEntity } from './entities/outbox-event.entity.js';
import { OutboxEventRepository } from './repositories/outbox-event.repository.js';
import { TypeOrmOutboxEventRepository } from './repositories/typeorm-outbox-event.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity])],
  providers: [
    {
      provide: OutboxEventRepository,
      useClass: TypeOrmOutboxEventRepository,
    },
  ],
  exports: [OutboxEventRepository],
})
export class WebhooksModule {}
