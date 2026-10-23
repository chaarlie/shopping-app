import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  IdempotencyKeyReusedError,
} from '../../../common/errors.js';
import { Env } from '../../../config/env.schema.js';
import { uniqueViolationConstraint } from '../../../database/errors.js';
import { PaymentEntity } from '../../entities/payment.entity.js';
import { hashPaymentRequest } from '../../payment-request-hash.js';
import { PaymentRepository } from '../../repositories/payment.repository.js';
import { authorizeTestCard } from '../../simulated-card-provider.js';
import { CreatePaymentCommand } from '../create-payment.command.js';

@CommandHandler(CreatePaymentCommand)
export class CreatePaymentCommandHandler implements ICommandHandler<CreatePaymentCommand> {
  private readonly settleDelayMs: number;

  constructor(
    private readonly payments: PaymentRepository,
    configService: ConfigService<Env, true>,
  ) {
    this.settleDelayMs = configService.get('PAYMENT_SETTLE_DELAY_MS', {
      infer: true,
    });
  }

  @Transactional()
  async execute({
    input,
    idempotencyKey,
  }: CreatePaymentCommand): Promise<PaymentEntity> {
    const requestHash = hashPaymentRequest(input);
    const existing = await this.payments.findByIdempotencyKey(idempotencyKey);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyKeyReusedError(
          'This Idempotency-Key was already used for a different payment request',
        );
      }

      return existing;
    }

    const authorization = authorizeTestCard(input.card.number);

    try {
      return await this.payments.insert({
        id: randomUUID(),
        orderReference: input.orderReference,
        idempotencyKey,
        requestHash,
        amountCents: input.amountCents,
        currency: input.currency,
        cardBrand: authorization.brand,
        cardLast4: authorization.last4,
        providerResponse: authorization.response,
        settleAt: new Date(Date.now() + this.settleDelayMs),
      });
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);

      if (constraint === 'payments_idempotency_key_key') {
        throw new ConflictError(
          'A request with this Idempotency-Key is still being processed. Send it again to get its result.',
        );
      }

      if (constraint === 'payments_one_active_per_order') {
        throw new ConflictError(
          `Order ${input.orderReference} already has a payment that is processing, succeeded or was refunded`,
        );
      }

      throw error;
    }
  }
}
