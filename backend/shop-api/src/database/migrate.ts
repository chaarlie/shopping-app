import { Logger } from '@nestjs/common';
import { validateEnv } from '../config/env.schema.js';
import { runMigrations } from './run-migrations.js';

const logger = new Logger('Migrations');
const { DATABASE_URL } = validateEnv(process.env);
const applied = await runMigrations(DATABASE_URL);

logger.log(
  applied.length > 0
    ? `Applied ${applied.join(', ')}`
    : 'Database is already up to date',
);
