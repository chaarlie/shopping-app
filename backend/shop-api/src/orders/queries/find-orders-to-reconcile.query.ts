import { Query } from '@nestjs/cqrs';

export interface OrdersToReconcile {
  toCheck: string[];
  toRefund: { reference: string; paymentId: string }[];
}

export class FindOrdersToReconcileQuery extends Query<OrdersToReconcile> {
  constructor(
    public readonly limit: number,
    public readonly unansweredAfterMs: number,
  ) {
    super();
  }
}
