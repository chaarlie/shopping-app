import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Card } from '@shop/contracts';
import { ConflictError } from '../../common/errors.js';
import { RecordPaymentSubmissionCommand } from '../commands/record-payment-submission.command.js';
import { OrderEntity } from '../entities/order.entity.js';
import { PaymentAttemptEntity } from '../entities/payment-attempt.entity.js';
import {
  PaymentRejectedError,
  PaymentsGateway,
  PaymentsUnavailableError,
} from './payments-gateway.js';

@Injectable()
export class PaymentAttemptSubmitter {
  private readonly logger = new Logger(PaymentAttemptSubmitter.name);

  constructor(
    private readonly gateway: PaymentsGateway,
    private readonly commandBus: CommandBus,
  ) {}

  async submit(
    order: OrderEntity,
    attempt: PaymentAttemptEntity,
    card: Card,
  ): Promise<void> {
    if (attempt.status !== 'requested') {
      return;
    }

    try {
      const payment = await this.gateway.createPayment(
        {
          orderReference: order.reference,
          amountCents: order.totalCents,
          currency: order.currency,
          card,
        },
        attempt.idempotencyKey,
      );

      await this.commandBus.execute(
        new RecordPaymentSubmissionCommand(order.reference, attempt.id, {
          kind: 'accepted',
          payment,
        }),
      );
    } catch (error) {
      if (error instanceof PaymentsUnavailableError) {
        this.logger.warn(
          `The payment for order ${order.reference} has an unknown outcome: ${error.message}`,
        );
        return;
      }

      if (error instanceof PaymentRejectedError && error.status === 409) {
        await this.commandBus.execute(
          new RecordPaymentSubmissionCommand(order.reference, attempt.id, {
            kind: 'refused',
            code: 'payment_in_progress',
            message: 'Another payment for this order is still being processed.',
          }),
        );
        throw new ConflictError(
          'A payment for this order is still being processed',
        );
      }

      throw error;
    }
  }
}
