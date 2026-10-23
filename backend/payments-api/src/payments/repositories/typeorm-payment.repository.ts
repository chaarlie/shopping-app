import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment.entity.js';
import { ProviderResponse } from '../simulated-card-provider.js';
import { NewPayment, PaymentRepository } from './payment.repository.js';

@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get repository(): Repository<PaymentEntity> {
    return this.txHost.tx.getRepository(PaymentEntity);
  }

  findById(id: string): Promise<PaymentEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByIdForUpdate(id: string): Promise<PaymentEntity | null> {
    return this.repository
      .createQueryBuilder('payment')
      .where('payment.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<PaymentEntity | null> {
    return this.repository.findOneBy({ idempotencyKey });
  }

  findByOrderReference(orderReference: string): Promise<PaymentEntity[]> {
    return this.repository.find({
      where: { orderReference },
      order: { createdAt: 'ASC' },
    });
  }

  async insert(payment: NewPayment): Promise<PaymentEntity> {
    await this.repository.insert(payment);
    return this.repository.findOneByOrFail({ id: payment.id });
  }

  findDueForSettlement(limit: number): Promise<PaymentEntity[]> {
    return this.repository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'processing' })
      .andWhere('payment.settleAt <= now()')
      .orderBy('payment.settleAt', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markSettled(
    id: string,
    response: ProviderResponse,
  ): Promise<PaymentEntity> {
    await this.repository.update(
      id,
      response.outcome === 'approved'
        ? { status: 'succeeded' }
        : {
            status: 'failed',
            failureCode: response.code,
            failureMessage: response.message,
          },
    );
    return this.repository.findOneByOrFail({ id });
  }

  async markRefunded(
    id: string,
    idempotencyKey: string,
  ): Promise<PaymentEntity> {
    await this.repository.update(id, {
      status: 'refunded',
      refundIdempotencyKey: idempotencyKey,
      refundedAt: new Date(),
    });
    return this.repository.findOneByOrFail({ id });
  }
}
