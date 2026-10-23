import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { randomUUID } from 'node:crypto';
import { OutboxEventRepository } from '../../../webhooks/repositories/outbox-event.repository.js';
import { paymentEventFor } from '../../payment-events.js';
import { PaymentRepository } from '../../repositories/payment.repository.js';
import { SettleDuePaymentsCommand } from '../settle-due-payments.command.js';

@CommandHandler(SettleDuePaymentsCommand)
export class SettleDuePaymentsCommandHandler implements ICommandHandler<SettleDuePaymentsCommand> {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly outbox: OutboxEventRepository,
  ) {}

  @Transactional()
  async execute({ limit }: SettleDuePaymentsCommand): Promise<number> {
    const due = await this.payments.findDueForSettlement(limit);

    for (const payment of due) {
      const settled = await this.payments.markSettled(
        payment.id,
        payment.providerResponse,
      );

      await this.outbox.add(
        paymentEventFor(settled, { id: randomUUID(), createdAt: new Date() }),
      );
    }

    return due.length;
  }
}
