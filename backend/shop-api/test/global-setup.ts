import { OpenSearchContainer } from '@testcontainers/opensearch';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../src/database/run-migrations.js';

export default async function setup(project: TestProject) {
  const [postgres, opensearch] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('shop')
      .withUsername('shop')
      .withPassword('shop')
      .start(),
    new OpenSearchContainer('opensearchproject/opensearch:3.5.0')
      .withSecurityEnabled(false)
      .withEnvironment({ OPENSEARCH_JAVA_OPTS: '-Xms512m -Xmx512m' })
      .start(),
  ]);

  const databaseUrl = postgres.getConnectionUri();
  await runMigrations(databaseUrl);
  project.provide('databaseUrl', databaseUrl);
  project.provide('opensearchUrl', opensearch.getHttpUrl());

  return async () => {
    await Promise.all([postgres.stop(), opensearch.stop()]);
  };
}
