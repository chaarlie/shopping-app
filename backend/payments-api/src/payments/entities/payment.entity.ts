import type { Currency, PaymentStatus } from '@shop/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ProviderResponse } from '../simulated-card-provider.js';

@Entity({ name: 'payments' })
export class PaymentEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'order_reference', type: 'text' })
  orderReference: string;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'text' })
  requestHash: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ type: 'char', length: 3 })
  currency: Currency;

  @Column({ type: 'text', default: 'processing' })
  status: PaymentStatus;

  @Column({ name: 'card_brand', type: 'text' })
  cardBrand: string;

  @Column({ name: 'card_last4', type: 'char', length: 4 })
  cardLast4: string;

  @Column({ name: 'provider_response', type: 'jsonb' })
  providerResponse: ProviderResponse;

  @Column({ name: 'settle_at', type: 'timestamptz' })
  settleAt: Date;

  @Column({ name: 'failure_code', type: 'text', nullable: true })
  failureCode: string | null;

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage: string | null;

  @Column({ name: 'refund_idempotency_key', type: 'text', nullable: true })
  refundIdempotencyKey: string | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
