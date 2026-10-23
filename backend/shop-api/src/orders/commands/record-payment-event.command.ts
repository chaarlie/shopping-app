import { Command } from '@nestjs/cqrs';
import type { PaymentEvent } from '@shop/contracts';

export type PaymentEventResult = 'applied' | 'repeat' | 'ignored' | 'flagged';

export class RecordPaymentEventCommand extends Command<PaymentEventResult> {
  constructor(public readonly event: PaymentEvent) {
    super();
  }
}
