import { stockCoversLines } from '../../domain/stock-covers-lines.js';
import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import type { Payment } from '@shop/contracts';
import { ProductRepository } from '../../../products/repositories/product.repository.js';
import {
  decideReconciliation,
  ReconciliationDecision,
} from '../../domain/decide-reconciliation.js';
import { OrderUpdatesPublisher } from '../../order-updates.publisher.js';
import {
  OrderAggregate,
  OrderRepository,
} from '../../repositories/order.repository.js';
import { ReconcileOrderCommand } from '../reconcile-order.command.js';

@CommandHandler(ReconcileOrderCommand)
export class ReconcileOrderCommandHandler implements ICommandHandler<ReconcileOrderCommand> {
  private readonly logger = new Logger(ReconcileOrderCommandHandler.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly updates: OrderUpdatesPublisher,
  ) {}

  @Transactional()
  async execute({
    reference,
    payments,
  }: ReconcileOrderCommand): Promise<ReconciliationDecision['kind']> {
    const found = await this.orders.findByReferenceForUpdate(reference);

    if (!found) {
      return 'leave';
    }

    if (found.order.status === 'cancelled') {
      await this.orders.deferReconciliation(found.order.id);
    }

    const decision = decideReconciliation(
      {
        status: found.order.status,
        dueAt: found.order.dueAt,
        totalCents: found.order.totalCents,
        attempts: found.attempts,
      },
      payments,
      new Date(),
    );

    if (decision.kind === 'leave') {
      return decision.kind;
    }

    if (decision.kind === 'flag') {
      this.logger.error(
        `Order ${reference} could not be reconciled and needs a person to check it: ${decision.reason}`,
      );
      return decision.kind;
    }

    if (decision.kind === 'mark_paid') {
      await this.markPaid(found, decision.payment);
    } else if (decision.kind === 'cancel') {
      await this.cancel(found);
    } else {
      await this.recordDeclines(found, decision.payments);
    }

    await this.updates.publish(reference);
    return decision.kind;
  }

  private async markPaid(
    { order, attempts, lines }: OrderAggregate,
    payment: Payment,
  ): Promise<void> {
    let status: 'paid' | 'refund_pending' = 'paid';
    if (order.status === 'cancelled') {
      const productIds = lines.flatMap(({ productId }) =>
        productId === null ? [] : [productId],
      );
      const products = await this.products.findByIdsForUpdate(productIds);
      if (stockCoversLines(lines, products)) {
        for (const { productId, quantity } of lines) {
          if (productId !== null) {
            await this.products.changeStock(productId, -quantity);
          }
        }
      } else {
        status = 'refund_pending';
      }
    }
    await this.orders.transition(order.id, order.status, {
      status,
      paymentId: payment.id,
    });

    const attempt = attempts.find(
      ({ idempotencyKey }) => idempotencyKey === payment.idempotencyKey,
    );

    if (attempt) {
      await this.orders.updateAttempt(attempt.id, {
        status: 'succeeded',
        paymentId: payment.id,
        cardLast4: payment.cardLast4,
      });
    }
  }

  private async cancel({ order, lines }: OrderAggregate): Promise<void> {
    for (const { productId, quantity } of lines) {
      if (productId !== null) {
        await this.products.changeStock(productId, quantity);
      }
    }

    await this.orders.transition(order.id, 'pending_payment', {
      status: 'cancelled',
    });
  }

  private async recordDeclines(
    { order, attempts }: OrderAggregate,
    payments: Payment[],
  ): Promise<void> {
    for (const payment of payments) {
      const attempt = attempts.find(
        ({ idempotencyKey }) => idempotencyKey === payment.idempotencyKey,
      );

      if (attempt) {
        await this.orders.updateAttempt(attempt.id, {
          status: 'declined',
          paymentId: payment.id,
          cardLast4: payment.cardLast4,
          declineCode: payment.failureCode,
          declineMessage: payment.failureMessage,
        });
      }
    }

    await this.orders.touch(order.id);
  }
}
