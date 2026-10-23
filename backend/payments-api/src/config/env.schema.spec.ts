import { validateEnv, validateMigrationEnv } from './env.schema.js';

const apiKey = 'a'.repeat(32);
const databaseUrl = 'postgresql://payments:secret@localhost:5432/payments';
const required = { PAYMENTS_API_KEY: apiKey, DATABASE_URL: databaseUrl };

describe('validateEnv', () => {
  it('fills in the defaults', () => {
    expect(validateEnv(required)).toEqual({
      PORT: 3000,
      PAYMENTS_API_KEY: apiKey,
      DATABASE_URL: databaseUrl,
      PAYMENT_SETTLE_DELAY_MS: 2000,
      BACKGROUND_JOBS: 'on',
    });
  });

  it('rejects a missing API key', () => {
    expect(() => validateEnv({ DATABASE_URL: databaseUrl })).toThrow(
      'Invalid environment variables',
    );
  });

  it('rejects a short API key', () => {
    expect(() =>
      validateEnv({ ...required, PAYMENTS_API_KEY: 'short' }),
    ).toThrow('Invalid environment variables');
  });

  it('requires a Postgres database URL', () => {
    expect(() =>
      validateEnv({
        ...required,
        DATABASE_URL: 'mysql://payments@db/payments',
      }),
    ).toThrow('Invalid environment variables');
  });

  it('lets the migration runner start with only a database URL', () => {
    expect(validateMigrationEnv({ DATABASE_URL: databaseUrl })).toEqual({
      DATABASE_URL: databaseUrl,
    });
  });

  it('reads the settle delay from a string', () => {
    expect(
      validateEnv({ ...required, PAYMENT_SETTLE_DELAY_MS: '0' })
        .PAYMENT_SETTLE_DELAY_MS,
    ).toBe(0);
  });
});
