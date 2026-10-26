import { DataSource } from 'typeorm';
import { bootstrapAdminSchema } from '@shop/contracts';
import { hashPassword } from './passwords.js';
import { validateMigrationEnv } from '../config/env.schema.js';
const input = bootstrapAdminSchema.parse({
  name: process.env.ADMIN_NAME,
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
const { DATABASE_URL } = validateMigrationEnv(process.env);
const source = new DataSource({ type: 'postgres', url: DATABASE_URL });
await source.initialize();
try {
  await source.transaction(async (manager) => {
    const rows = await manager.query<{ id: number }[]>(
      'INSERT INTO admins(name,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash RETURNING id',
      [input.name, input.email, await hashPassword(input.password)],
    );
    await manager.query('DELETE FROM admin_sessions WHERE admin_id=$1', [
      rows[0].id,
    ]);
  });
  process.stdout.write('Admin account saved. Existing sessions revoked.\n');
} finally {
  await source.destroy();
}
