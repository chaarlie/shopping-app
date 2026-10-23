import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { WebhookDeliveryEntity } from '../entities/webhook-delivery.entity.js';
import {
  NewWebhookDelivery,
  WebhookDeliveryRepository,
} from './webhook-delivery.repository.js';

@Injectable()
export class TypeOrmWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async log(delivery: NewWebhookDelivery): Promise<void> {
    await this.txHost.tx.getRepository(WebhookDeliveryEntity).insert(delivery);
  }
}
