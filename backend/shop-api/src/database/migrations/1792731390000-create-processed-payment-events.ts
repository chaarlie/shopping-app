import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcessedPaymentEvents1792731390000 implements MigrationInterface {
  name = 'CreateProcessedPaymentEvents1792731390000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE processed_payment_events (
        event_id uuid PRIMARY KEY,
        type text NOT NULL,
        order_reference text NOT NULL,
        outcome text NOT NULL,
        detail text,
        received_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT processed_payment_events_outcome_check CHECK (
          outcome IN ('received', 'applied', 'ignored', 'flagged')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX processed_payment_events_flagged_idx
        ON processed_payment_events (received_at)
        WHERE outcome = 'flagged'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE processed_payment_events');
  }
}
