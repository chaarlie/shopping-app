import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Payment } from '@shop/contracts';
import { IntervalJob } from '../../common/jobs/interval-job.js';
import { Env } from '../../config/env.schema.js';
import { MarkOrderRefundedCommand } from '../commands/mark-order-refunded.command.js';
import { ReconcileOrderCommand } from '../commands/reconcile-order.command.js';
import { unansweredAttemptMs } from '../domain/payment-rules.js';
import {
  PaymentRejectedError,
  PaymentsGateway,
  PaymentsUnavailableError,
} from '../payments/payments-gateway.js';
import { FindOrdersToReconcileQuery } from '../queries/find-orders-to-reconcile.query.js';

const INTERVAL_MS = 60_000;
const BATCH_SIZE = 50;

type RefundResult = 'refunded' | 'unavailable' | 'refused';

@Injectable()
export class OrderReconciliationJob extends IntervalJob {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly gateway: PaymentsGateway,
    configService: ConfigService<Env, true>,
  ) {
    super(
      configService.get('BACKGROUND_JOBS', { infer: true }) === 'on',
      INTERVAL_MS,
    );
  }

  async runOnce(): Promise<void> {
    const { toCheck, toRefund } = await this.queryBus.execute(
      new FindOrdersToReconcileQuery(BATCH_SIZE, unansweredAttemptMs),
    );

    for (const reference of toCheck) {
      const payments = await this.paymentsOf(reference);

      if (!payments) {
        return;
      }

      await this.commandBus.execute(
        new ReconcileOrderCommand(reference, payments),
      );
    }

    for (const { reference, paymentId } of toRefund) {
      const result = await this.refund(reference, paymentId);

      if (result === 'unavailable') {
        return;
      }

      if (result === 'refunded') {
        await this.commandBus.execute(new MarkOrderRefundedCommand(reference));
      }
    }
  }

  private async paymentsOf(reference: string): Promise<Payment[] | null> {
    try {
      return await this.gateway.listPayments(reference);
    } catch (error) {
      if (error instanceof PaymentsUnavailableError) {
        this.logger.warn(
          `Could not reach payments-api to reconcile orders, so nothing was cancelled: ${error.message}. Trying again in a minute.`,
        );
        return null;
      }

      throw error;
    }
  }

  private async refund(
    reference: string,
    paymentId: string,
  ): Promise<RefundResult> {
    try {
      await this.gateway.refundPayment(paymentId, `refund:${paymentId}`);
      return 'refunded';
    } catch (error) {
      if (error instanceof PaymentsUnavailableError) {
        this.logger.warn(
          `Could not reach payments-api to refund order ${reference}: ${error.message}. Trying again in a minute.`,
        );
        return 'unavailable';
      }

      if (error instanceof PaymentRejectedError) {
        this.logger.error(
          `payments-api refused to refund payment ${paymentId} for order ${reference}, which needs a person to check it: ${error.message}`,
        );
        return 'refused';
      }

      throw error;
    }
  }
}
