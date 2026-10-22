import { MigrationInterface } from 'typeorm';
import { CreateProducts1792650817000 } from './1792650817000-create-products.js';

export const migrations: (new () => MigrationInterface)[] = [
  CreateProducts1792650817000,
];
