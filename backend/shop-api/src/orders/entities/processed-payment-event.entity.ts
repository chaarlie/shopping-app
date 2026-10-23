import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type PaymentEventOutcome =
  'received' | 'applied' | 'ignored' | 'flagged';

@Entity({ name: 'processed_payment_events' })
export class ProcessedPaymentEventEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'text' })
  type: string;

  @Column({ name: 'order_reference', type: 'text' })
  orderReference: string;

  @Column({ type: 'text' })
  outcome: PaymentEventOutcome;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}
