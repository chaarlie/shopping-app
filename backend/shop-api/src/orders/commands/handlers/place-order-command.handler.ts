import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import {
  ConflictError,
  IdempotencyKeyReusedError,
  ValidationError,
} from '../../../common/errors.js';
import { ProductRepository } from '../../../products/repositories/product.repository.js';
import { hashOrderRequest } from '../../domain/order-request-hash.js';
import { newOrderReference } from '../../domain/order-reference.js';
import { paymentWindowMs } from '../../domain/payment-rules.js';
import { priceCart } from '../../domain/price-cart.js';
import { OrderRepository } from '../../repositories/order.repository.js';
import { OrderAttempt } from '../order-attempt.js';
import { PlaceOrderCommand } from '../place-order.command.js';

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderCommandHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
  ) {}

  @Transactional()
  async execute({
    input,
    idempotencyKey,
  }: PlaceOrderCommand): Promise<OrderAttempt> {
    const products = await this.products.findByIdsForUpdate(
      input.items.map((item) => item.productId),
    );
    const requestHash = hashOrderRequest(input);
    const existing = await this.orders.findByIdempotencyKey(idempotencyKey);

    if (existing) {
      if (existing.order.requestHash !== requestHash) {
        throw new IdempotencyKeyReusedError(
          'This Idempotency-Key was already used for a different order',
        );
      }

      return { order: existing.order, attempt: existing.attempts[0] };
    }

    const limit = this.config.get('ORDER_MAX_QUANTITY_PER_PRODUCT', {
      infer: true,
    });
    if (input.items.some((item) => item.quantity > limit)) {
      throw new ValidationError(
        `Quantity must be at most ${limit} per product`,
      );
    }

    const pricing = priceCart(input.items, products);

    if (!pricing.ok) {
      throw pricing.problem === 'out_of_stock'
        ? new ConflictError(pricing.message)
        : new ValidationError(pricing.message);
    }

    for (const line of pricing.lines) {
      if (!(await this.products.changeStock(line.productId, -line.quantity))) {
        throw new ConflictError(`${line.name} is out of stock`);
      }
    }

    const reference = await this.unusedReference();
    const { order, attempts } = await this.orders.create(
      {
        reference,
        idempotencyKey,
        requestHash,
        name: input.name,
        email: input.email,
        totalCents: pricing.totalCents,
        currency: 'USD',
        dueAt: new Date(Date.now() + paymentWindowMs),
      },
      pricing.lines,
      `${reference}:${idempotencyKey}`,
    );

    return { order, attempt: attempts[0] };
  }

  private async unusedReference(): Promise<string> {
    for (let tries = 0; tries < 5; tries++) {
      const reference = newOrderReference();

      if (!(await this.orders.referenceExists(reference))) {
        return reference;
      }
    }

    throw new Error('Could not find an unused order reference');
  }
}
