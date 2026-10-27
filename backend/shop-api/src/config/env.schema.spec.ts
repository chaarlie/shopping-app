import { validateEnv, validateMigrationEnv } from './env.schema.js';

const databaseUrl = 'postgresql://shop:secret@localhost:5432/shop';
const required = {
  DATABASE_URL: databaseUrl,
  PAYMENTS_API_URL: 'http://payments-api:3000',
  PAYMENTS_API_KEY: 'k'.repeat(32),
  PAYMENT_WEBHOOK_SECRET: 'whsec_bG9jYWwtb25seS13ZWJob29rLWtleS1jaGFuZ2UtbWUh',
  ORDER_ACCESS_SECRET: 's'.repeat(32),
  OPENSEARCH_URL: 'http://opensearch:9200',
};

describe('validateEnv', () => {
  it('fills in the defaults', () => {
    expect(validateEnv(required)).toEqual({
      ...required,
      APP_ORIGIN: 'http://localhost:8080',
      IMPORT_MAX_FILE_BYTES: 5_000_000,
      IMPORT_MAX_ROWS: 5_000,
      PORT: 3000,
      ORDER_COOKIE_SECURE: true,
      OPENSEARCH_INDEX: 'products',
      BACKGROUND_JOBS: 'on',
    });
  });

  it('refuses a search index name OpenSearch would reject', () => {
    expect(() =>
      validateEnv({ ...required, OPENSEARCH_INDEX: 'Products' }),
    ).toThrow('Invalid environment variables');
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
});

it('allows extending uploads to ten MB but rejects an unbounded configuration', () => {
  expect(
    validateEnv({ ...required, IMPORT_MAX_FILE_BYTES: '10000000' })
      .IMPORT_MAX_FILE_BYTES,
  ).toBe(10_000_000);
  expect(() =>
    validateEnv({ ...required, IMPORT_MAX_FILE_BYTES: '10000001' }),
  ).toThrow();
  expect(() =>
    validateEnv({ ...required, IMPORT_MAX_ROWS: '20001' }),
  ).toThrow();
});
