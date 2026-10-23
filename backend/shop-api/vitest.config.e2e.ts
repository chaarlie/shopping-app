import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    env: {
      PAYMENTS_API_URL: 'http://127.0.0.1:9',
      PAYMENTS_API_KEY: 'e2e-payments-key-0123456789abcdef0123456',
      PAYMENT_WEBHOOK_SECRET: 'whsec_bG9jYWwtb25seS13ZWJob29rLWtleS1jaGFuZ2UtbWUh',
      ORDER_ACCESS_SECRET: 'e2e-order-access-secret-0123456789abcdef',
      ORDER_COOKIE_SECURE: 'false',
      BACKGROUND_JOBS: 'off',
    },
  },
});
