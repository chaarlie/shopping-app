import { z } from 'zod';
const endpoint = z.url({ protocol: /^https?$/ }).refine((value) => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === '/'
  );
}, 'Use a storage origin without credentials, path, query or fragment');
export const importStorageSchema = z.object({
  endpoint,
  publicEndpoint: endpoint,
  region: z.string().min(1).default('us-east-1'),
  bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  accessKey: z.string().min(3),
  secretKey: z.string().min(8),
});
