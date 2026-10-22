import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../src/database/run-migrations.js';

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('shop')
    .withUsername('shop')
    .withPassword('shop')
    .start();

  const databaseUrl = container.getConnectionUri();
  await runMigrations(databaseUrl);
  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container.stop();
  };
}
