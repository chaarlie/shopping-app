import { z } from 'zod';
const pendingSchema = z.object({
  key: z.string().uuid(),
  fingerprint: z.string(),
});
export async function paymentIntent(
  storageKey: string,
  input: unknown,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(input)),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const saved = sessionStorage.getItem(storageKey);
  if (saved) {
    const pending = pendingSchema.parse(JSON.parse(saved));
    if (pending.fingerprint !== fingerprint) {
      throw new Error(
        'Your previous request has an unknown outcome. Retry with the same customer, items and test card before changing them.',
      );
    }
    return pending.key;
  }
  const key = crypto.randomUUID();
  sessionStorage.setItem(storageKey, JSON.stringify({ key, fingerprint }));
  return key;
}
export function clearPaymentIntent(storageKey: string) {
  sessionStorage.removeItem(storageKey);
}
