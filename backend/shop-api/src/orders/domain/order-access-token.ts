import { createHmac, timingSafeEqual } from 'node:crypto';

export function orderAccessToken(reference: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`order-access:${reference}`)
    .digest('base64url');
}

export function isOrderAccessToken(
  token: string,
  reference: string,
  secret: string,
): boolean {
  const expected = Buffer.from(orderAccessToken(reference, secret));
  const received = Buffer.from(token);

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
