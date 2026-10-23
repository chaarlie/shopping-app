import { createHmac, timingSafeEqual } from 'node:crypto';

export const signatureHeader = 'x-signature';

export const defaultToleranceSeconds = 300;

export type SignatureCheck =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'malformed' | 'expired' | 'mismatch' };

export interface VerifyOptions {
  now?: number;
  toleranceSeconds?: number;
}

export function signPayload(
  payload: string | Buffer,
  secret: string,
  timestamp: number = currentTimestamp(),
): string {
  return `t=${timestamp},v1=${digest(secret, timestamp, payload)}`;
}

export function verifySignature(
  payload: string | Buffer,
  header: string | undefined,
  secret: string,
  {
    now = currentTimestamp(),
    toleranceSeconds = defaultToleranceSeconds,
  }: VerifyOptions = {},
): SignatureCheck {
  if (!header) {
    return { valid: false, reason: 'missing' };
  }

  const parsed = parseHeader(header);

  if (!parsed) {
    return { valid: false, reason: 'malformed' };
  }

  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return { valid: false, reason: 'expired' };
  }

  const expected = Buffer.from(
    digest(secret, parsed.timestamp, payload),
    'hex',
  );
  const received = Buffer.from(parsed.signature, 'hex');

  return timingSafeEqual(expected, received)
    ? { valid: true }
    : { valid: false, reason: 'mismatch' };
}

function parseHeader(
  header: string,
): { timestamp: number; signature: string } | null {
  const fields = new Map(
    header.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key, value.join('=')];
    }),
  );
  const timestamp = Number(fields.get('t'));
  const signature = fields.get('v1') ?? '';

  if (!Number.isSafeInteger(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) {
    return null;
  }

  return { timestamp, signature };
}

function digest(
  secret: string,
  timestamp: number,
  payload: string | Buffer,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest('hex');
}

function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
