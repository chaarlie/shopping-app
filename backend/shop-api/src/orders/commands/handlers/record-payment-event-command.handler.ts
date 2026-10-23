import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import type { OrderStatus, PaymentEvent } from '@shop/contracts';
import { ProductRepository } from '../../../products/repositories/product.repository.js';
import { decidePaymentEvent } from '../../domain/decide-payment-event.js';
import { stockCoversLines } from '../../domain/stock-covers-lines.js';
import { OrderLineEntity } from '../../entities/order-line.entity.js';
import { OrderEntity } from '../../entities/order.entity.js';
import { PaymentAttemptEntity } from '../../entities/payment-attempt.entity.js';
import { OrderUpdatesPublisher } from '../../order-updates.publisher.js';
import { OrderRepository } from '../../repositories/order.repository.js';
import { ProcessedPaymentEventRepository } from '../../repositories/processed-payment-event.repository.js';
import {
  PaymentEventResult,
  RecordPaymentEventCommand,
} from '../record-payment-event.command.js';

@CommandHandler(RecordPaymentEventCommand)
export class RecordPaymentEventCommandHandler implements ICommandHandler<RecordPaymentEventCommand> {
  private readonly logger = new Logger(RecordPaymentEventCommandHandler.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly processedEvents: ProcessedPaymentEventRepository,
    private readonly updates: OrderUpdatesPublisher,
  ) {}

  @Transactional()
  async execute({
    event,
  }: RecordPaymentEventCommand): Promise<PaymentEventResult> {
    if (!(await this.processedEvents.recordIfNew(event))) {
      return 'repeat';
    }

    const found = await this.orders.findByReferenceForUpdate(
      event.data.orderReference,
    );
    const attempt =
      found?.attempts.find(
        ({ idempotencyKey }) => idempotencyKey === event.data.idempotencyKey,
      ) ?? null;
    const decision = decidePaymentEvent(
      found && {
        status: found.order.status,
        totalCents: found.order.totalCents,
        currency: found.order.currency,
        paymentId: found.order.paymentId,
        attempt,
      },
      event,
    );

    if (!found || decision.kind === 'flag' || decision.kind === 'ignore') {
      const reason = 'reason' in decision ? decision.reason : 'unknown_order';
      const outcome = decision.kind === 'ignore' ? 'ignored' : 'flagged';

      if (outcome === 'flagged') {
        this.logger.error(
          `Payment event ${event.id} for order ${event.data.orderReference} was not applied and needs a person to check it: ${reason}`,
        );
      }

      await this.processedEvents.settle(event.id, outcome, reason);
      return outcome;
    }

    const { order, lines } = found;
    let detail = 'declined';

    if (decision.kind === 'mark_paid') {
      await this.move(order, 'pending_payment', 'paid', event);
      detail = 'paid';
    } else if (decision.kind === 'take_stock_again') {
      detail = await this.takeStockAgain(order, lines, event);
    } else {
      await this.recordDecline(order, attempt, event);
    }

    await this.markAttempt(attempt, event);
    await this.processedEvents.settle(event.id, 'applied', detail);
    await this.updates.publish(order.reference);

    return 'applied';
  }

  private async takeStockAgain(
    order: OrderEntity,
    lines: OrderLineEntity[],
    event: PaymentEvent,
  ): Promise<string> {
    const productIds = lines.flatMap(({ productId }) =>
      productId === null ? [] : [productId],
    );
    const products = await this.products.findByIdsForUpdate(productIds);

    if (!stockCoversLines(lines, products)) {
      await this.move(order, 'cancelled', 'refund_pending', event);
      return 'late_payment_to_refund';
    }

    for (const { productId, quantity } of lines) {
      if (productId !== null) {
        await this.products.changeStock(productId, -quantity);
      }
    }

    await this.move(order, 'cancelled', 'paid', event);
    return 'late_payment_stock_taken';
  }

  private async recordDecline(
    order: OrderEntity,
    attempt: PaymentAttemptEntity | null,
    event: PaymentEvent,
  ): Promise<void> {
    if (attempt && event.type === 'payment.failed') {
      await this.orders.updateAttempt(attempt.id, {
        status: 'declined',
        declineCode: event.data.failureCode,
        declineMessage: event.data.failureMessage,
      });
    }

    await this.orders.touch(order.id);
  }

  private async markAttempt(
    attempt: PaymentAttemptEntity | null,
    event: PaymentEvent,
  ): Promise<void> {
    if (!attempt) {
      return;
    }

    await this.orders.updateAttempt(attempt.id, {
      paymentId: event.data.paymentId,
      cardLast4: event.data.cardLast4,
      ...(event.type === 'payment.succeeded' ? { status: 'succeeded' } : {}),
    });
  }

  private async move(
    order: OrderEntity,
    from: OrderStatus,
    to: OrderStatus,
    event: PaymentEvent,
  ): Promise<void> {
    const moved = await this.orders.transition(order.id, from, {
      status: to,
      paymentId: event.data.paymentId,
    });

    if (!moved) {
      throw new Error(
        `Order ${order.reference} was not ${from} when payment event ${event.id} was applied`,
      );
    }
  }
}
