import { Order } from '@shop/contracts';
import { OrderAggregate } from './repositories/order.repository.js';

export function toOrder({ order, lines, attempts }: OrderAggregate): Order {
  const latest = attempts.at(-1);

  return {
    reference: order.reference,
    status: order.status,
    name: order.name,
    email: order.email,
    items: lines.map((line) => ({
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.unitPriceCents * line.quantity,
    })),
    totalCents: order.totalCents,
    currency: order.currency,
    dueAt: order.dueAt.toISOString(),
    payment: latest
      ? {
          status: latest.status,
          cardLast4: latest.cardLast4,
          declineCode: latest.declineCode,
          declineMessage: latest.declineMessage,
        }
      : null,
    version: order.version,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
