import { randomBytes } from 'node:crypto';

const crockfordAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function orderReferenceFrom(bytes: Uint8Array): string {
  if (bytes.length < 8) {
    throw new RangeError('An order reference needs 8 random bytes');
  }

  const characters = Array.from(
    bytes.subarray(0, 8),
    (byte) => crockfordAlphabet[byte % crockfordAlphabet.length],
  ).join('');

  return `SR-${characters.slice(0, 4)}-${characters.slice(4)}`;
}

export function newOrderReference(): string {
  return orderReferenceFrom(randomBytes(8));
}
