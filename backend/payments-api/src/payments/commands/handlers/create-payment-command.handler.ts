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
   *
   * This demo payment implementation creates payment record using a simulated provider;
   * it does not contact a bank, verify ownership of a real card, or check an actual
   * account balance. In a prod scenario the input validation should reject malformed
   * card details and expired cards before this handler runs.
   * Format checks, including a Luhn checksum, can detect typing mistakes
   * but cannot establish that a card is valid or
   * that sufficient funds are available. Here, authorizeTestCard selects a
   * simulated outcome from the supplied test card number.
   *
   * A production integration should collect card details through the payment
   * provider's hosted fields and receive a payment token. The provider and
   * issuing bank handle card verification, available funds or credit, fraud
   * checks, and any required customer authentication. Authorization reserves
   * funds; capture completes the charge, so a successful authorization must not
   * automatically be treated as a captured payment.
   *
   * amountCents represents USD in integer cents: $19.99 is stored as 1999.
   * TypeScript's number type does not guarantee integer or safe arithmetic,
   * so runtime validation must enforce positive safe integers and application
   * amount limits. Validate calculated totals as well as individual amounts,
   * and convert decimal input without relying on floating-point multiplication.
   * Store amounts in an appropriately bounded integer database column; use
   * bigint or a decimal library if the supported range exceeds safe integers.
   * Always obtain payable totals from trusted server-side order data.
   *
   * The idempotency key and request hash allow an identical request to return
   * its existing payment while rejecting reuse with different request data.
   * Database uniqueness constraints also protect against concurrent requests
   * and multiple active payments for the same order. The transaction keeps
   * local database changes atomic, but it cannot make an external provider
   * request atomic with those changes.
   *
   * Real provider calls must therefore happen outside this transaction, using
   * a durable payment attempt and a stable provider idempotency key. A timeout
   * leaves the outcome unknown: retry or reconcile the same attempt instead of
   * creating another charge. Persist confirmed outcomes and outgoing events
   * atomically, then deliver signed webhooks through the outbox.
   * @param param0
   * @returns
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
