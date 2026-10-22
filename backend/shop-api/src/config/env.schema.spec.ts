import { validateEnv } from './env.schema.js';

const databaseUrl = 'postgresql://shop:secret@localhost:5432/shop';

describe('validateEnv', () => {
  it('defaults the port to 3000', () => {
    expect(validateEnv({ DATABASE_URL: databaseUrl })).toEqual({
      PORT: 3000,
      DATABASE_URL: databaseUrl,
    });
  });

  it('reads the port from a string', () => {
    expect(
      validateEnv({ PORT: '8080', DATABASE_URL: databaseUrl }).PORT,
    ).toBe(8080);
  });

  it('rejects a port that is not a number', () => {
    expect(() =>
      validateEnv({ PORT: 'abc', DATABASE_URL: databaseUrl }),
    ).toThrow('Invalid environment variables');
  });

  it('requires a database URL', () => {
    expect(() => validateEnv({})).toThrow('Invalid environment variables');
  });

  it('rejects a database URL that is not Postgres', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'mysql://shop@localhost/shop' }),
    ).toThrow('Invalid environment variables');
  });
});
