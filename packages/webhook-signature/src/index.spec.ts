import { signPayload, verifySignature } from './index.js';

const secret = 'whsec_test_0123456789abcdef0123456789abcdef';
const timestamp = 1792800000;
const body = '{"id":"evt_1","type":"payment.succeeded"}';
const header = signPayload(body, secret, timestamp);

describe('signPayload', () => {
  it('signs the timestamp and the body with HMAC-SHA256', () => {
    expect(header).toBe(
      't=1792800000,v1=ad73538f693948409094d8b5a9684b6dac4bb10721d3732995f1ab13893c3be6',
    );
  });
});

describe('verifySignature', () => {
  it('accepts a signature made with the same secret', () => {
    expect(
      verifySignature(Buffer.from(body), header, secret, {
        now: timestamp + 10,
      }),
    ).toEqual({ valid: true });
  });

  it('rejects a body that was changed after signing', () => {
    expect(
      verifySignature(body.replace('succeeded', 'failed'), header, secret, {
        now: timestamp,
      }),
    ).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('rejects a signature made with another secret', () => {
    const forged = signPayload(
      body,
      'whsec_someone_else_0123456789abcdef',
      timestamp,
    );

    expect(verifySignature(body, forged, secret, { now: timestamp })).toEqual({
      valid: false,
      reason: 'mismatch',
    });
  });

  it('rejects a timestamp more than five minutes old', () => {
    expect(
      verifySignature(body, header, secret, { now: timestamp + 301 }),
    ).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects a timestamp more than five minutes ahead', () => {
    expect(
      verifySignature(body, header, secret, { now: timestamp - 301 }),
    ).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects a request without a signature', () => {
    expect(verifySignature(body, undefined, secret)).toEqual({
      valid: false,
      reason: 'missing',
    });
  });

  it('rejects a header it cannot read', () => {
    expect(verifySignature(body, 't=soon,v1=abc', secret)).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });
});
