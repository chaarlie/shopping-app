import { MigrationInterface } from 'typeorm';
import { CreateProducts1792650817000 } from './1792650817000-create-products.js';
import { CreateOrders1792730811000 } from './1792730811000-create-orders.js';
import { CreateProcessedPaymentEvents1792731390000 } from './1792731390000-create-processed-payment-events.js';

export const migrations: (new () => MigrationInterface)[] = [
  CreateProducts1792650817000,
  CreateOrders1792730811000,
  CreateProcessedPaymentEvents1792731390000,
];
