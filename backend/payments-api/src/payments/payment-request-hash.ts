import { CreatePaymentInput } from '@shop/contracts';
import { createHash } from 'node:crypto';

export function hashPaymentRequest(input: CreatePaymentInput): string {
  const fields = [
    input.orderReference,
    input.amountCents,
    input.currency,
    input.card.number.slice(-4),
    input.card.expMonth,
    input.card.expYear,
  ];

  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}
