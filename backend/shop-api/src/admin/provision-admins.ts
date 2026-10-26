import { readFile, stat } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import { validateMigrationEnv } from '../config/env.schema.js';
import {
  parseAdmins,
  provisionAdmins,
  ProvisioningInputError,
} from './admin-provisioning.js';
async function main() {
  const [file, ...options] = process.argv.slice(2);
  if (
    !file ||
    file.startsWith('--') ||
    options.length > 1 ||
    options.some((option) => option !== '--replace-existing')
  ) {
    throw new ProvisioningInputError(
      'Usage: admin:provision <admins.yaml> [--replace-existing]',
    );
  }
  if ((await stat(file)).size > 1_048_576) {
    throw new ProvisioningInputError('Admin YAML must be at most 1 MB');
  }
  const accounts = parseAdmins(await readFile(file, 'utf8'), process.env);
  const { DATABASE_URL } = validateMigrationEnv(process.env);
  const source = new DataSource({ type: 'postgres', url: DATABASE_URL });
  await source.initialize();
  try {
    const result = await provisionAdmins(
      source,
      accounts,
      options.includes('--replace-existing'),
    );
    process.stdout.write(
      `Admin provisioning complete: ${result.saved} saved, ${result.skipped} skipped.\n`,
    );
  } finally {
    await source.destroy();
  }
}
try {
  await main();
} catch (error) {
  if (error instanceof ProvisioningInputError) {
    process.stderr.write(`${error.message}\n`);
  }
  process.stderr.write(
    'Admin provisioning failed. Check the YAML, password environment variables, database connection and command arguments. No credentials are printed.\n',
  );
  process.exitCode = 1;
}
