import { Webhook } from 'standardwebhooks';
import { isWebhookSecret, signPayload, verifySignature } from './index.js';

const secret = `whsec_${Buffer.alloc(32, 7).toString('base64')}`;
const timestamp = 1792800000;
const id = 'evt_1';
const body = '{"id":"evt_1","type":"payment.succeeded"}';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(timestamp * 1000);
});

afterEach(() => vi.useRealTimers());

it('produces headers accepted by the reference implementation', () => {
  const headers = signPayload(body, secret, id, timestamp);
  expect(headers['webhook-id']).toBe(id);
  expect(headers['webhook-timestamp']).toBe(String(timestamp));
  expect(new Webhook(secret).verify(body, headers)).toEqual(JSON.parse(body));
});

it('accepts a reference signature against the raw bytes', () => {
  const headers = {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': new Webhook(secret).sign(
      id,
      new Date(timestamp * 1000),
      body,
    ),
  };
  expect(verifySignature(Buffer.from(body), headers, secret)).toEqual({
    valid: true,
  });
  expect(verifySignature(body + ' ', headers, secret).valid).toBe(false);
});

it('rejects an altered message ID, timestamp, body or secret', () => {
  const headers = signPayload(body, secret, id, timestamp);
  expect(
    verifySignature(body, { ...headers, 'webhook-id': 'evt_2' }, secret).valid,
  ).toBe(false);
  expect(
    verifySignature(
      body,
      { ...headers, 'webhook-timestamp': String(timestamp + 1) },
      secret,
    ).valid,
  ).toBe(false);
  expect(
    verifySignature(body.replace('succeeded', 'failed'), headers, secret).valid,
  ).toBe(false);
  expect(
    verifySignature(
      body,
      headers,
      `whsec_${Buffer.alloc(32, 8).toString('base64')}`,
    ).valid,
  ).toBe(false);
});

it.each([-301, 301])(
  'rejects timestamps outside the tolerance: %i',
  (offset) => {
    expect(
      verifySignature(
        body,
        signPayload(body, secret, id, timestamp + offset),
        secret,
      ).valid,
    ).toBe(false);
  },
);

it.each(['webhook-id', 'webhook-timestamp', 'webhook-signature'])(
  'requires %s',
  (name) => {
    const headers: Record<string, string> = signPayload(
      body,
      secret,
      id,
      timestamp,
    );
    delete headers[name];
    expect(verifySignature(body, headers, secret).valid).toBe(false);
  },
);

it('rejects malformed and repeated headers', () => {
  const headers = signPayload(body, secret, id, timestamp);
  expect(
    verifySignature(
      body,
      { ...headers, 'webhook-timestamp': `${timestamp}junk` },
      secret,
    ).valid,
  ).toBe(false);
  expect(
    verifySignature(
      body,
      {
        ...headers,
        'webhook-signature': ['v1,bad', headers['webhook-signature']],
      },
      secret,
    ).valid,
  ).toBe(false);
  expect(
    verifySignature(body, { ...headers, 'webhook-signature': 'v1,bad' }, secret)
      .valid,
  ).toBe(false);
});

it('accepts a matching signature among multiple rotation signatures', () => {
  const headers = signPayload(body, secret, id, timestamp);
  const other = signPayload(
    body,
    `whsec_${Buffer.alloc(32, 8).toString('base64')}`,
    id,
    timestamp,
  );
  expect(
    verifySignature(
      body,
      {
        ...headers,
        'webhook-signature': `${other['webhook-signature']} ${headers['webhook-signature']}`,
      },
      secret,
    ).valid,
  ).toBe(true);
});

it('leaves payload schema validation to the API', () => {
  const payload = '{"not":"a payment event"}';
  expect(
    verifySignature(payload, signPayload(payload, secret, id), secret).valid,
  ).toBe(true);
});

it('requires canonical base64 secrets containing 24 to 64 bytes', () => {
  expect(isWebhookSecret(secret)).toBe(true);
  for (const value of [
    'w'.repeat(32),
    'whsec_!!!!',
    `whsec_${Buffer.alloc(23).toString('base64')}`,
    `whsec_${Buffer.alloc(65).toString('base64')}`,
  ]) {
    expect(isWebhookSecret(value)).toBe(false);
  }
});
