import { importStorageSchema } from './storage-config.js';
const config = {
  endpoint: 'http://minio:9000',
  publicEndpoint: 'http://localhost:9100',
  bucket: 'stockroom-imports',
  accessKey: 'test-key',
  secretKey: 'test-secret-key',
};
it('keeps internal and browser signing origins distinct', () => {
  expect(importStorageSchema.parse(config).publicEndpoint).toBe(
    'http://localhost:9100',
  );
});
it('requires explicit credentials and refuses proxy paths that change signatures', () => {
  expect(
    importStorageSchema.safeParse({ ...config, secretKey: undefined }).success,
  ).toBe(false);
  expect(
    importStorageSchema.safeParse({
      ...config,
      publicEndpoint: 'https://example.test/storage',
    }).success,
  ).toBe(false);
});
