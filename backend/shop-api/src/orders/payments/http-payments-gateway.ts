import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { paymentListSchema, paymentSchema } from '@shop/contracts';
import type { CreatePaymentInput, Payment } from '@shop/contracts';
import { z } from 'zod';
import { Env } from '../../config/env.schema.js';
import {
  PaymentRejectedError,
  PaymentsGateway,
  PaymentsUnavailableError,
} from './payments-gateway.js';

const TIMEOUT_MS = 5000;

interface RequestOptions {
  body?: unknown;
  idempotencyKey?: string;
}

@Injectable()
export class HttpPaymentsGateway implements PaymentsGateway {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(configService: ConfigService<Env, true>) {
    this.baseUrl = configService.get('PAYMENTS_API_URL', { infer: true });
    this.apiKey = configService.get('PAYMENTS_API_KEY', { infer: true });
  }

  async createPayment(
    input: CreatePaymentInput,
    idempotencyKey: string,
  ): Promise<Payment> {
    return read(
      paymentSchema,
      await this.request('POST', '/payments', { body: input, idempotencyKey }),
    );
  }

  async listPayments(orderReference: string): Promise<Payment[]> {
    const query = new URLSearchParams({ orderReference });

    return read(
      paymentListSchema,
      await this.request('GET', `/payments?${query.toString()}`),
    ).items;
  }

  async refundPayment(
    paymentId: string,
    idempotencyKey: string,
  ): Promise<Payment> {
    return read(
      paymentSchema,
      await this.request(
        'POST',
        `/payments/${encodeURIComponent(paymentId)}/refunds`,
        { idempotencyKey },
      ),
    );
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    { body, idempotencyKey }: RequestOptions = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
    };
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    let response: Response;

    try {
      response = await fetch(new URL(path, this.baseUrl), init);
    } catch (error) {
      throw new PaymentsUnavailableError(
        `payments-api did not answer: ${describe(error)}`,
      );
    }

    const payload: unknown = await response.json().catch(() => null);

    if (response.status >= 500) {
      throw new PaymentsUnavailableError(
        `payments-api answered ${response.status}`,
      );
    }

    if (!response.ok) {
      throw new PaymentRejectedError(
        response.status,
        messageOf(payload) ?? `payments-api answered ${response.status}`,
      );
    }

    return payload;
  }
}

function read<T extends z.ZodType>(schema: T, payload: unknown): z.output<T> {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new PaymentsUnavailableError(
      'payments-api sent an answer shop-api could not read',
    );
  }

  return result.data;
}

function messageOf(payload: unknown): string | null {
  const message = (payload as { message?: unknown } | null)?.message;

  return typeof message === 'string' ? message : null;
}

function describe(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `no answer within ${TIMEOUT_MS / 1000} s`;
  }

  return error instanceof Error ? error.message : String(error);
}
