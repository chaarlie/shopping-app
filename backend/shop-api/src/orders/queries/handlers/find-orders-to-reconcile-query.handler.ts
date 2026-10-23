import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  FindOrdersToReconcileQuery,
  OrdersToReconcile,
} from '../find-orders-to-reconcile.query.js';

@QueryHandler(FindOrdersToReconcileQuery)
export class FindOrdersToReconcileQueryHandler implements IQueryHandler<FindOrdersToReconcileQuery> {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async execute({
    limit,
    unansweredAfterMs,
  }: FindOrdersToReconcileQuery): Promise<OrdersToReconcile> {
    const toCheck = await this.txHost.tx.query<{ reference: string }[]>(
      `
        SELECT o.reference
        FROM orders o
        WHERE o.status = 'pending_payment'
          AND (
            o.due_at <= now()
            OR EXISTS (
              SELECT 1
              FROM payment_attempts a
              WHERE a.order_id = o.id
                AND a.status IN ('requested', 'processing')
                AND a.updated_at <= now() - make_interval(secs => $1)
            )
          )
        ORDER BY o.due_at
        LIMIT $2
      `,
      [unansweredAfterMs / 1000, limit],
    );
    const toRefund = await this.txHost.tx.query<
      { reference: string; payment_id: string }[]
    >(
      `
        SELECT reference, payment_id
        FROM orders
        WHERE status = 'refund_pending' AND payment_id IS NOT NULL
        ORDER BY updated_at
        LIMIT $1
      `,
      [limit],
    );

    return {
      toCheck: toCheck.map(({ reference }) => reference),
      toRefund: toRefund.map(({ reference, payment_id }) => ({
        reference,
        paymentId: payment_id,
      })),
    };
  }
}
