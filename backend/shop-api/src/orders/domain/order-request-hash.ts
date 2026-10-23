import { PlaceOrderInput } from '@shop/contracts';
import { createHash } from 'node:crypto';

export function hashOrderRequest(input: PlaceOrderInput): string {
  const items = [...input.items]
    .sort((a, b) => a.productId - b.productId)
    .map((item) => [item.productId, item.quantity]);
  const fields = [
    input.name,
    input.email,
    items,
    input.card.number.slice(-4),
    input.card.expMonth,
    input.card.expYear,
  ];

  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}
