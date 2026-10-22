import { validateEnv } from './env.schema.js';

const apiKey = 'a'.repeat(32);

describe('validateEnv', () => {
  it('accepts an API key of at least 32 characters', () => {
    expect(validateEnv({ PAYMENTS_API_KEY: apiKey })).toEqual({
      PORT: 3000,
      PAYMENTS_API_KEY: apiKey,
    });
  });

  it('rejects a missing API key', () => {
    expect(() => validateEnv({})).toThrow('Invalid environment variables');
  });

  it('rejects a short API key', () => {
    expect(() => validateEnv({ PAYMENTS_API_KEY: 'short' })).toThrow(
      'Invalid environment variables',
    );
  });
});
