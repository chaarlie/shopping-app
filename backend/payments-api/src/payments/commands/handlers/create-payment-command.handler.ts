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

  /**
   * Records a payment against a simulated card provider. No bank is
   * contacted: the shared contract accepts only the published test cards,
   * and authorizeTestCard picks the outcome from the card number, so card
   * ownership, funds and fraud are never checked.
   *
   * A real integration would collect the card through the provider's hosted
   * fields and receive a token instead of a card number. The provider and the
   * issuing bank then handle verification, funds, fraud checks and customer
   * authentication. An authorization only reserves funds and a capture
   * completes the charge, so the two would be tracked as separate states.
   *
   * The same idempotency key with the same request hash returns the existing
   * payment, and a reused key with different data is refused. The unique
   * indexes keep both rules, and the one-active-payment-per-order rule, true
   * under concurrent requests.
   *
   * The transaction covers only local writes. A real provider call would
   * happen outside it, from a saved attempt with a stable idempotency key, so
   * a timeout is retried or reconciled as the same attempt and never becomes
   * a second charge.
   */
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
