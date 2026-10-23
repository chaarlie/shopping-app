import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders1792730811000 implements MigrationInterface {
  name = 'CreateOrders1792730811000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE orders (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        reference text NOT NULL,
        idempotency_key text NOT NULL,
        request_hash text NOT NULL,
        name text NOT NULL,
        email text NOT NULL,
        status text NOT NULL DEFAULT 'pending_payment',
        total_cents integer NOT NULL,
        currency char(3) NOT NULL,
        due_at timestamptz NOT NULL,
        payment_id uuid,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT orders_reference_key UNIQUE (reference),
        CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key),
        CONSTRAINT orders_total_cents_check CHECK (total_cents > 0),
        CONSTRAINT orders_status_check CHECK (
          status IN ('pending_payment', 'paid', 'cancelled', 'refund_pending', 'refunded')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX orders_pending_due_idx
        ON orders (due_at)
        WHERE status = 'pending_payment'
    `);
    await queryRunner.query(`
      CREATE TABLE order_lines (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        order_id integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
        product_id integer REFERENCES products (id) ON DELETE SET NULL,
        sku text NOT NULL,
        name text NOT NULL,
        unit_price_cents integer NOT NULL,
        quantity integer NOT NULL,
        CONSTRAINT order_lines_unit_price_cents_check CHECK (unit_price_cents > 0),
        CONSTRAINT order_lines_quantity_check CHECK (quantity > 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX order_lines_order_id_idx ON order_lines (order_id)',
    );
    await queryRunner.query(
      'CREATE INDEX order_lines_product_id_idx ON order_lines (product_id)',
    );
    await queryRunner.query(`
      CREATE TABLE payment_attempts (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        order_id integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
        idempotency_key text NOT NULL,
        payment_id uuid,
        status text NOT NULL DEFAULT 'requested',
        card_last4 char(4),
        decline_code text,
        decline_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT payment_attempts_idempotency_key_key UNIQUE (idempotency_key),
        CONSTRAINT payment_attempts_status_check CHECK (
          status IN ('requested', 'processing', 'succeeded', 'declined')
        )
      )
    `);
    await queryRunner.query(
      'CREATE INDEX payment_attempts_order_id_idx ON payment_attempts (order_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_attempts');
    await queryRunner.query('DROP TABLE order_lines');
    await queryRunner.query('DROP TABLE orders');
  }
}
