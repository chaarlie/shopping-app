import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookDeliveries1792730485000 implements MigrationInterface {
  name = 'CreateWebhookDeliveries1792730485000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE webhook_deliveries (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        event_id uuid NOT NULL REFERENCES outbox_events (id),
        attempt integer NOT NULL,
        status_code integer,
        error text,
        duration_ms integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT webhook_deliveries_event_attempt_key UNIQUE (event_id, attempt)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE webhook_deliveries');
  }
}
