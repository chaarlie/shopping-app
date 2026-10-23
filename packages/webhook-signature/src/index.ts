import { Webhook, WebhookVerificationError } from 'standardwebhooks';

export type WebhookHeaders = Record<string, string> & {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
};

export type SignatureCheck =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'malformed' | 'invalid' };

export function isWebhookSecret(secret: string): boolean {
  if (!secret.startsWith('whsec_')) {
    return false;
  }

  const encoded = secret.slice(6);
  const bytes = Buffer.from(encoded, 'base64');
  return (
    bytes.length >= 24 &&
    bytes.length <= 64 &&
    bytes.toString('base64') === encoded
  );
}

export function signPayload(
  payload: string | Buffer,
  secret: string,
  id: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): WebhookHeaders {
  return {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': new Webhook(secret).sign(
      id,
      new Date(timestamp * 1000),
      payload,
    ),
  };
}

export function verifySignature(
  payload: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): SignatureCheck {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signature = headers['webhook-signature'];

  if (!id || !timestamp || !signature) {
    return { valid: false, reason: 'missing' };
  }

  if (
    typeof id !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof signature !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(id) ||
    !/^[0-9]+$/.test(timestamp) ||
    !Number.isSafeInteger(Number(timestamp))
  ) {
    return { valid: false, reason: 'malformed' };
  }

  try {
    new Webhook(secret).verify(
      payload,
      {
        'webhook-id': id,
        'webhook-timestamp': timestamp,
        'webhook-signature': signature,
      },
      { jsonParse: false },
    );
    return { valid: true };
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return { valid: false, reason: 'invalid' };
    }

    throw error;
  }
}
