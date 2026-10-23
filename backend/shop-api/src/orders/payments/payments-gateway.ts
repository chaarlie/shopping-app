import type { CreatePaymentInput, Payment } from '@shop/contracts';

export class PaymentsUnavailableError extends Error {}

export class PaymentRejectedError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export abstract class PaymentsGateway {
  abstract createPayment(
    input: CreatePaymentInput,
    idempotencyKey: string,
  ): Promise<Payment>;

  abstract listPayments(orderReference: string): Promise<Payment[]>;

  abstract refundPayment(
    paymentId: string,
    idempotencyKey: string,
  ): Promise<Payment>;
}
