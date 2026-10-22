import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      PAYMENTS_API_KEY: 'e2e-test-key-0123456789abcdef0123456789',
    },
  },
});
