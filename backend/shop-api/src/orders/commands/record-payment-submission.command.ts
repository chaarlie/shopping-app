import { Command } from '@nestjs/cqrs';
import type { Payment } from '@shop/contracts';

export type PaymentSubmission =
  | { kind: 'accepted'; payment: Payment }
  | { kind: 'refused'; code: string; message: string };

export class RecordPaymentSubmissionCommand extends Command<void> {
  constructor(
    public readonly reference: string,
    public readonly attemptId: number,
    public readonly submission: PaymentSubmission,
  ) {
    super();
  }
}
