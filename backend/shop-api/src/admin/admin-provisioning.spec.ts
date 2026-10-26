import { parseAdmins } from './admin-provisioning.js';
const manifest =
  'admins:\n  - name: Reviewer\n    email: REVIEWER@example.com\n    passwordEnv: REVIEWER_PASSWORD\n';
describe('admin provisioning input', () => {
  it('normalizes emails and resolves passwords from environment references', () => {
    expect(
      parseAdmins(manifest, { REVIEWER_PASSWORD: 'long-local-password' }),
    ).toEqual([
      {
        name: 'Reviewer',
        email: 'reviewer@example.com',
        password: 'long-local-password',
      },
    ]);
  });
  it('rejects missing or weak passwords before opening the database', () => {
    expect(() => parseAdmins(manifest, {})).toThrow('REVIEWER_PASSWORD');
    expect(() => parseAdmins(manifest, { REVIEWER_PASSWORD: 'short' })).toThrow(
      '12–256',
    );
  });
  it('rejects duplicate normalized emails, unknown fields and inline passwords', () => {
    const env = { REVIEWER_PASSWORD: 'long-local-password' };
    expect(() =>
      parseAdmins(
        manifest +
          '  - name: Other\n    email: reviewer@example.com\n    passwordEnv: REVIEWER_PASSWORD\n',
        env,
      ),
    ).toThrow('unique');
    expect(() => parseAdmins(manifest + '    password: secret\n', env)).toThrow(
      'only',
    );
  });
  it('rejects malformed YAML, duplicate keys, aliases and oversized inputs', () => {
    expect(() => parseAdmins('admins: [', {})).toThrow('Invalid admin YAML');
    expect(() => parseAdmins('admins: []\nadmins: []', {})).toThrow(
      'Invalid admin YAML',
    );
    expect(() => parseAdmins('admins: &a [*a]', {})).toThrow(
      'Invalid admin YAML',
    );
    expect(() => parseAdmins('x'.repeat(1_048_577), {})).toThrow('1 MB');
  });
});
