import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('defaults the port to 3000', () => {
    expect(validateEnv({})).toEqual({ PORT: 3000 });
  });

  it('reads the port from a string', () => {
    expect(validateEnv({ PORT: '8080' })).toEqual({ PORT: 8080 });
  });

  it('rejects a port that is not a number', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      'Invalid environment variables',
    );
  });
});
