import { MigrationInterface } from 'typeorm';
import { CreatePayments1792729159000 } from './1792729159000-create-payments.js';

export const migrations: (new () => MigrationInterface)[] = [
  CreatePayments1792729159000,
];
