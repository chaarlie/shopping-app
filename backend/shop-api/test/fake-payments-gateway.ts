import type { CreatePaymentInput, Payment } from '@shop/contracts';
import { randomUUID } from 'node:crypto';
import {
  PaymentRejectedError,
  PaymentsGateway,
  PaymentsUnavailableError,
} from '../src/orders/payments/payments-gateway.js';

export interface PaymentRequest {
  input: CreatePaymentInput;
  idempotencyKey: string;
}

export class FakePaymentsGateway extends PaymentsGateway {
  requests: PaymentRequest[] = [];
  payments: Payment[] = [];
  refunds: string[] = [];
  answer: 'accept' | 'unavailable' | 'conflict' = 'accept';

  reset(): void {
    this.requests = [];
    this.payments = [];
    this.refunds = [];
    this.answer = 'accept';
  }

  createPayment(
    input: CreatePaymentInput,
    idempotencyKey: string,
  ): Promise<Payment> {
    this.requests.push({ input, idempotencyKey });

    if (this.answer === 'unavailable') {
      return Promise.reject(
        new PaymentsUnavailableError('payments-api did not answer'),
      );
    }

    if (this.answer === 'conflict') {
      return Promise.reject(
        new PaymentRejectedError(409, 'The order already has a payment'),
      );
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: randomUUID(),
      orderReference: input.orderReference,
      status: 'processing',
      amountCents: input.amountCents,
      currency: input.currency,
      cardBrand: 'visa',
      cardLast4: input.card.number.slice(-4),
      failureCode: null,
      failureMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.payments.push(payment);

    return Promise.resolve(payment);
  }

  listPayments(orderReference: string): Promise<Payment[]> {
    if (this.answer === 'unavailable') {
      return Promise.reject(
        new PaymentsUnavailableError('payments-api did not answer'),
      );
    }

    return Promise.resolve(
      this.payments.filter(
        (payment) => payment.orderReference === orderReference,
      ),
    );
  }

  refundPayment(paymentId: string): Promise<Payment> {
    const payment = this.payments.find(({ id }) => id === paymentId);

    if (this.answer === 'unavailable' || !payment) {
      return Promise.reject(
        new PaymentsUnavailableError('payments-api did not answer'),
      );
    }

    this.refunds.push(paymentId);
    payment.status = 'refunded';

    return Promise.resolve(payment);
  }
}
