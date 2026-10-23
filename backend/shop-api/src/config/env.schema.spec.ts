import { validateEnv, validateMigrationEnv } from './env.schema.js';

const databaseUrl = 'postgresql://shop:secret@localhost:5432/shop';
const required = {
  DATABASE_URL: databaseUrl,
  PAYMENTS_API_URL: 'http://payments-api:3000',
  PAYMENTS_API_KEY: 'k'.repeat(32),
  PAYMENT_WEBHOOK_SECRET: 'w'.repeat(32),
  ORDER_ACCESS_SECRET: 's'.repeat(32),
};

describe('validateEnv', () => {
  it('fills in the defaults', () => {
    expect(validateEnv(required)).toEqual({
      ...required,
      PORT: 3000,
      ORDER_COOKIE_SECURE: true,
      BACKGROUND_JOBS: 'on',
    });
  });

  it('reads the port from a string', () => {
    expect(validateEnv({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a port that is not a number', () => {
    expect(() => validateEnv({ ...required, PORT: 'abc' })).toThrow(
      'Invalid environment variables',
    );
  });

  it('requires a database URL', () => {
    expect(() => validateEnv({ ...required, DATABASE_URL: undefined })).toThrow(
      'Invalid environment variables',
    );
  });

  it('rejects a database URL that is not Postgres', () => {
    expect(() =>
      validateEnv({ ...required, DATABASE_URL: 'mysql://shop@localhost/shop' }),
    ).toThrow('Invalid environment variables');
  });

  it('rejects a short order access secret', () => {
    expect(() =>
      validateEnv({ ...required, ORDER_ACCESS_SECRET: 'short' }),
    ).toThrow('Invalid environment variables');
  });

  it('turns the secure cookie flag off only when asked', () => {
    expect(
      validateEnv({ ...required, ORDER_COOKIE_SECURE: 'false' })
        .ORDER_COOKIE_SECURE,
    ).toBe(false);
  });

  it('lets the migration runner start with only a database URL', () => {
    expect(validateMigrationEnv({ DATABASE_URL: databaseUrl })).toEqual({
      DATABASE_URL: databaseUrl,
    });
  });
});
