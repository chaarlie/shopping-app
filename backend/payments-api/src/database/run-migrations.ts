import { DataSource } from 'typeorm';
import { migrations } from './migrations/index.js';

export async function runMigrations(databaseUrl: string): Promise<string[]> {
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    migrations,
  });

  await dataSource.initialize();

  try {
    const applied = await dataSource.runMigrations();
    return applied.map((migration) => migration.name);
  } finally {
    await dataSource.destroy();
  }
}
