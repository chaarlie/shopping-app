import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'webhook_deliveries' })
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'integer' })
  attempt: number;

  @Column({ name: 'status_code', type: 'integer', nullable: true })
  statusCode: number | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
