import { DataSource } from 'typeorm';
import { provisionAdmins } from '../src/admin/admin-provisioning.js';
import { verifyPassword } from '../src/admin/passwords.js';
describe('admin provisioning (e2e)', () => {
  let db: DataSource;
  const account = {
    name: 'Provisioned Admin',
    email: 'provisioned@example.test',
    password: 'initial-password-123',
  };
  beforeAll(async () => {
    db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL });
    await db.initialize();
  });
  beforeEach(async () => {
    await db.query(
      "DELETE FROM admin_sessions WHERE admin_id IN (SELECT id FROM admins WHERE email IN ('provisioned@example.test','rollback@example.test'))",
    );
    await db.query(
      "DELETE FROM admins WHERE email IN ('provisioned@example.test','rollback@example.test')",
    );
  });
  afterAll(async () => {
    await db.destroy();
  });
  it('creates accounts, preserves credentials and sessions on rerun, and replaces only explicitly', async () => {
    expect(await provisionAdmins(db, [account])).toEqual({
      saved: 1,
      skipped: 0,
    });
    const [original] = await db.query<{ id: number; password_hash: string }[]>(
      'SELECT id,password_hash FROM admins WHERE email=$1',
      [account.email],
    );
    expect(await verifyPassword(account.password, original.password_hash)).toBe(
      true,
    );
    await db.query(
      "INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      ['cd'.repeat(32), original.id],
    );
    const changed = {
      ...account,
      name: 'Changed',
      password: 'replacement-password-123',
    };
    expect(await provisionAdmins(db, [changed])).toEqual({
      saved: 0,
      skipped: 1,
    });
    const [preserved] = await db.query<
      { name: string; password_hash: string }[]
    >('SELECT name,password_hash FROM admins WHERE id=$1', [original.id]);
    expect(preserved).toEqual({
      name: account.name,
      password_hash: original.password_hash,
    });
    expect(
      (
        await db.query('SELECT 1 FROM admin_sessions WHERE admin_id=$1', [
          original.id,
        ])
      ).length,
    ).toBe(1);
    expect(await provisionAdmins(db, [changed], true)).toEqual({
      saved: 1,
      skipped: 0,
    });
    const [updated] = await db.query<{ name: string; password_hash: string }[]>(
      'SELECT name,password_hash FROM admins WHERE id=$1',
      [original.id],
    );
    expect(updated.name).toBe('Changed');
    expect(await verifyPassword(changed.password, updated.password_hash)).toBe(
      true,
    );
    expect(
      (
        await db.query('SELECT 1 FROM admin_sessions WHERE admin_id=$1', [
          original.id,
        ])
      ).length,
    ).toBe(0);
    await provisionAdmins(db, []);
    expect(
      (await db.query('SELECT 1 FROM admins WHERE id=$1', [original.id]))
        .length,
    ).toBe(1);
  });
  it('rolls back the whole batch if a database write fails', async () => {
    await expect(
      provisionAdmins(db, [
        account,
        { ...account, email: 'rollback@example.test', name: 'x'.repeat(201) },
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query('SELECT 1 FROM admins WHERE email=$1', [account.email]))
        .length,
    ).toBe(0);
  });
});
