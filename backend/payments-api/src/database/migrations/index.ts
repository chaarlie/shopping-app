import { MigrationInterface } from 'typeorm';
import { CreatePayments1792729159000 } from './1792729159000-create-payments.js';
import { CreateWebhookDeliveries1792730485000 } from './1792730485000-create-webhook-deliveries.js';

export const migrations: (new () => MigrationInterface)[] = [
  CreatePayments1792729159000,
  CreateWebhookDeliveries1792730485000,
];
