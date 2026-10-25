import { MigrationInterface, QueryRunner } from 'typeorm';
export class RecordImportFileErrors1792886600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE product_imports ADD COLUMN file_error text');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE product_imports DROP COLUMN file_error');
  }
}
