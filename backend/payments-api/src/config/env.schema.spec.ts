import { validateEnv, validateMigrationEnv } from './env.schema.js';

const apiKey = 'a'.repeat(32);
const databaseUrl = 'postgresql://payments:secret@localhost:5432/payments';
const webhookUrl = 'http://shop-api:3000/webhooks/payments';
const webhookSecret = 'whsec_bG9jYWwtb25seS13ZWJob29rLWtleS1jaGFuZ2UtbWUh';
const required = {
  PAYMENTS_API_KEY: apiKey,
  DATABASE_URL: databaseUrl,
  PAYMENT_WEBHOOK_URL: webhookUrl,
  PAYMENT_WEBHOOK_SECRET: webhookSecret,
};

describe('validateEnv', () => {
  it('fills in the defaults', () => {
    expect(validateEnv(required)).toEqual({
      ...required,
      PORT: 3000,
      PAYMENT_SETTLE_DELAY_MS: 2000,
      BACKGROUND_JOBS: 'on',
    });
  });

  it('rejects a missing API key', () => {
    expect(() =>
      validateEnv({ ...required, PAYMENTS_API_KEY: undefined }),
    ).toThrow('Invalid environment variables');
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

  it('requires an HTTP URL for the webhook receiver', () => {
    expect(() =>
      validateEnv({ ...required, PAYMENT_WEBHOOK_URL: 'ftp://shop-api/hooks' }),
    ).toThrow('Invalid environment variables');
  });

  it('rejects a short webhook secret', () => {
    expect(() =>
      validateEnv({ ...required, PAYMENT_WEBHOOK_SECRET: 'short' }),
    ).toThrow('Invalid environment variables');
  });

  it.each([
    'w'.repeat(32),
    'whsec_!!!!',
    `whsec_${Buffer.alloc(8).toString('base64')}`,
  ])('rejects an invalid webhook secret: %s', (secret) => {
    expect(() =>
      validateEnv({ ...required, PAYMENT_WEBHOOK_SECRET: secret }),
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
