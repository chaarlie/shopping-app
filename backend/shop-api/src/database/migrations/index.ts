import { CreateAdmins1792886400000 } from './1792886400000-create-admins.js';
import { MigrationInterface } from 'typeorm';
import { CreateProducts1792650817000 } from './1792650817000-create-products.js';
import { CreateOrders1792730811000 } from './1792730811000-create-orders.js';
import { CreateProcessedPaymentEvents1792731390000 } from './1792731390000-create-processed-payment-events.js';
import { CreateProductSearchOutbox1792767812000 } from './1792767812000-create-product-search-outbox.js';

export const migrations: (new () => MigrationInterface)[] = [
  CreateAdmins1792886400000,
  CreateProducts1792650817000,
  CreateOrders1792730811000,
  CreateProcessedPaymentEvents1792731390000,
  CreateProductSearchOutbox1792767812000,
];
