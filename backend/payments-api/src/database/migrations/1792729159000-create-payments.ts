import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1792729159000 implements MigrationInterface {
  name = 'CreatePayments1792729159000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payments (
        id uuid PRIMARY KEY,
        order_reference text NOT NULL,
        idempotency_key text NOT NULL,
        request_hash text NOT NULL,
        amount_cents integer NOT NULL,
        currency char(3) NOT NULL,
        status text NOT NULL DEFAULT 'processing',
        card_brand text NOT NULL,
        card_last4 char(4) NOT NULL,
        provider_response jsonb NOT NULL,
        settle_at timestamptz NOT NULL,
        failure_code text,
        failure_message text,
        refund_idempotency_key text,
        refunded_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT payments_idempotency_key_key UNIQUE (idempotency_key),
        CONSTRAINT payments_refund_idempotency_key_key UNIQUE (refund_idempotency_key),
        CONSTRAINT payments_amount_cents_check CHECK (amount_cents > 0),
        CONSTRAINT payments_status_check
          CHECK (status IN ('processing', 'succeeded', 'failed', 'refunded'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX payments_one_active_per_order
        ON payments (order_reference)
        WHERE status IN ('processing', 'succeeded', 'refunded')
    `);
    await queryRunner.query(
      'CREATE INDEX payments_order_reference_idx ON payments (order_reference)',
    );
    await queryRunner.query(`
      CREATE INDEX payments_due_for_settlement_idx
        ON payments (settle_at)
        WHERE status = 'processing'
    `);
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY,
        type text NOT NULL,
        payload jsonb NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        locked_until timestamptz,
        delivered_at timestamptz,
        dead_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX outbox_events_due_idx
        ON outbox_events (next_attempt_at)
        WHERE delivered_at IS NULL AND dead_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE outbox_events');
    await queryRunner.query('DROP TABLE payments');
  }
}
