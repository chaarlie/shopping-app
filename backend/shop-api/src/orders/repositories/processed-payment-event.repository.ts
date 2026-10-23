import type { PaymentEvent } from '@shop/contracts';
import { PaymentEventOutcome } from '../entities/processed-payment-event.entity.js';

export abstract class ProcessedPaymentEventRepository {
  abstract recordIfNew(event: PaymentEvent): Promise<boolean>;

  abstract settle(
    eventId: string,
    outcome: Exclude<PaymentEventOutcome, 'received'>,
    detail: string | null,
  ): Promise<void>;
}
