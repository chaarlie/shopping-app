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
      PAYMENTS_API_KEY: 'e2e-test-key-0123456789abcdef0123456789',
      PAYMENT_WEBHOOK_URL: 'http://127.0.0.1:9/webhooks/payments',
      PAYMENT_WEBHOOK_SECRET: 'whsec_bG9jYWwtb25seS13ZWJob29rLWtleS1jaGFuZ2UtbWUh',
      PAYMENT_SETTLE_DELAY_MS: '0',
      BACKGROUND_JOBS: 'off',
    },
  },
});
