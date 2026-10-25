import { MigrationInterface, QueryRunner } from 'typeorm';
export class ReconcileCancelledOrders1792960000000 implements MigrationInterface {
  async up(query: QueryRunner): Promise<void> {
    await query.query(
      'ALTER TABLE orders ADD COLUMN reconcile_after timestamptz NOT NULL DEFAULT now()',
    );
    await query.query(
      "CREATE INDEX orders_cancelled_reconcile ON orders(reconcile_after) WHERE status='cancelled'",
    );
  }
  async down(query: QueryRunner): Promise<void> {
    await query.query('DROP INDEX orders_cancelled_reconcile');
    await query.query('ALTER TABLE orders DROP COLUMN reconcile_after');
  }
}
