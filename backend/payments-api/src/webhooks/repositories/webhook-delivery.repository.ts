import { WebhookDeliveryEntity } from '../entities/webhook-delivery.entity.js';

export type NewWebhookDelivery = Pick<
  WebhookDeliveryEntity,
  'eventId' | 'attempt' | 'statusCode' | 'error' | 'durationMs'
>;

export abstract class WebhookDeliveryRepository {
  abstract log(delivery: NewWebhookDelivery): Promise<void>;
}
