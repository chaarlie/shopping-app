import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { OrderStatus } from '@shop/contracts';
import { EntityManager } from 'typeorm';
import { OrderLineEntity } from '../entities/order-line.entity.js';
import { OrderEntity } from '../entities/order.entity.js';
import { PaymentAttemptEntity } from '../entities/payment-attempt.entity.js';
import {
  NewOrder,
  NewOrderLine,
  OrderAggregate,
  OrderChanges,
  OrderRepository,
  PaymentAttemptChanges,
} from './order.repository.js';

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get manager(): EntityManager {
    return this.txHost.tx;
  }

  referenceExists(reference: string): Promise<boolean> {
    return this.manager.getRepository(OrderEntity).existsBy({ reference });
  }

  async findByReference(reference: string): Promise<OrderAggregate | null> {
    return this.withParts(
      await this.manager.getRepository(OrderEntity).findOneBy({ reference }),
    );
  }

  async findByReferenceForUpdate(
    reference: string,
  ): Promise<OrderAggregate | null> {
    return this.withParts(
      await this.manager
        .getRepository(OrderEntity)
        .createQueryBuilder('orders')
        .where('orders.reference = :reference', { reference })
        .setLock('pessimistic_write')
        .getOne(),
    );
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OrderAggregate | null> {
    return this.withParts(
      await this.manager
        .getRepository(OrderEntity)
        .findOneBy({ idempotencyKey }),
    );
  }

  async create(
    order: NewOrder,
    lines: NewOrderLine[],
    attemptKey: string,
  ): Promise<OrderAggregate> {
    const orders = this.manager.getRepository(OrderEntity);
    const { identifiers } = await orders.insert(order);
    const orderId = identifiers[0].id as number;

    await this.manager
      .getRepository(OrderLineEntity)
      .insert(lines.map((line) => ({ ...line, orderId })));
    await this.manager
      .getRepository(PaymentAttemptEntity)
      .insert({ orderId, idempotencyKey: attemptKey });

    return this.withPartsOf(await orders.findOneByOrFail({ id: orderId }));
  }

  async transition(
    id: number,
    from: OrderStatus,
    changes: OrderChanges,
  ): Promise<boolean> {
    const { affected } = await this.manager
      .createQueryBuilder()
      .update(OrderEntity)
      .set(changes)
      .where('id = :id AND status = :from', { id, from })
      .execute();

    return affected === 1;
  }

  async touch(id: number): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(OrderEntity)
      .set({ version: () => 'version + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async addAttempt(
    orderId: number,
    idempotencyKey: string,
  ): Promise<PaymentAttemptEntity> {
    const attempts = this.manager.getRepository(PaymentAttemptEntity);
    const { identifiers } = await attempts.insert({ orderId, idempotencyKey });

    return attempts.findOneByOrFail({ id: identifiers[0].id as number });
  }

  async updateAttempt(
    id: number,
    changes: PaymentAttemptChanges,
  ): Promise<void> {
    await this.manager.getRepository(PaymentAttemptEntity).update(id, changes);
  }

  private async withParts(
    order: OrderEntity | null,
  ): Promise<OrderAggregate | null> {
    return order ? this.withPartsOf(order) : null;
  }

  private async withPartsOf(order: OrderEntity): Promise<OrderAggregate> {
    const lines = await this.manager
      .getRepository(OrderLineEntity)
      .find({ where: { orderId: order.id }, order: { id: 'ASC' } });
    const attempts = await this.manager
      .getRepository(PaymentAttemptEntity)
      .find({ where: { orderId: order.id }, order: { id: 'ASC' } });

    return { order, lines, attempts };
  }
}
