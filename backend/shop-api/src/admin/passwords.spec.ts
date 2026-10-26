import {
  hashPassword,
  verifyPassword,
  sessionHash,
  dummyPasswordHash,
} from './passwords.js';
describe('admin credentials', () => {
  it('salts password hashes and rejects a different password', async () => {
    const first = await hashPassword('example-password');
    const second = await hashPassword('example-password');
    expect(first).not.toBe(second);
    expect(await verifyPassword('example-password', first)).toBe(true);
    expect(await verifyPassword('different-password', first)).toBe(false);
    expect(await verifyPassword('example-password', dummyPasswordHash)).toBe(
      false,
    );
  });
  it('stores a deterministic digest instead of the session token', () => {
    const token = 'ab'.repeat(32);
    expect(sessionHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionHash(token)).not.toBe(token);
    expect(sessionHash(token)).toBe(sessionHash(token));
  });
});
