import type { PaymentAttemptStatus } from '@shop/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'payment_attempts' })
export class PaymentAttemptEntity {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'order_id', type: 'integer' })
  orderId: number;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'text', default: 'requested' })
  status: PaymentAttemptStatus;

  @Column({ name: 'card_last4', type: 'char', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'decline_code', type: 'text', nullable: true })
  declineCode: string | null;

  @Column({ name: 'decline_message', type: 'text', nullable: true })
  declineMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
