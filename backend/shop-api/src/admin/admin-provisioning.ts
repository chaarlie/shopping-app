import { bootstrapAdminSchema } from '@shop/contracts';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import type { DataSource } from 'typeorm';
import { hashPassword } from './passwords.js';
export class ProvisioningInputError extends Error {}
const accountSchema = bootstrapAdminSchema.omit({ password: true }).extend({
  passwordEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
});
const manifestSchema = z.strictObject({
  admins: z
    .array(accountSchema)
    .min(1)
    .max(100)
    .refine(
      (admins) =>
        new Set(admins.map((admin) => admin.email)).size === admins.length,
      'Admin emails must be unique',
    ),
});
export function parseAdmins(source: string, env: NodeJS.ProcessEnv) {
  if (Buffer.byteLength(source) > 1_048_576) {
    throw new ProvisioningInputError('Admin YAML must be at most 1 MB');
  }
  let data: unknown;
  try {
    const document = parseDocument(source, { uniqueKeys: true });
    if (document.errors.length || document.warnings.length) {
      throw new ProvisioningInputError('Invalid YAML');
    }
    data = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new ProvisioningInputError(
      'Invalid admin YAML. Use one document without aliases or duplicate keys.',
    );
  }
  const manifest = manifestSchema.safeParse(data);
  if (!manifest.success) {
    throw new ProvisioningInputError(
      'Admin YAML requires 1–100 unique accounts with name, email and passwordEnv only.',
    );
  }
  return manifest.data.admins.map(({ passwordEnv, ...admin }) => {
    const account = bootstrapAdminSchema.safeParse({
      ...admin,
      password: env[passwordEnv],
    });
    if (!account.success) {
      throw new ProvisioningInputError(
        `Set ${passwordEnv} to a password of 12–256 characters before provisioning.`,
      );
    }
    return account.data;
  });
}
export async function provisionAdmins(
  source: DataSource,
  accounts: ReturnType<typeof parseAdmins>,
  replaceExisting = false,
) {
  const prepared: { name: string; email: string; hash: string }[] = [];
  for (const account of accounts) {
    prepared.push({
      name: account.name,
      email: account.email,
      hash: await hashPassword(account.password),
    });
  }
  return source.transaction(async (manager) => {
    let saved = 0;
    let skipped = 0;
    for (const account of prepared) {
      const rows = await manager.query<{ id: number }[]>(
        `INSERT INTO admins(name,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) ${replaceExisting ? 'DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash' : 'DO NOTHING'} RETURNING id`,
        [account.name, account.email, account.hash],
      );
      if (!rows.length) {
        skipped += 1;
        continue;
      }
      saved += 1;
      if (replaceExisting) {
        await manager.query('DELETE FROM admin_sessions WHERE admin_id=$1', [
          rows[0].id,
        ]);
      }
    }
    return { saved, skipped };
  });
}
