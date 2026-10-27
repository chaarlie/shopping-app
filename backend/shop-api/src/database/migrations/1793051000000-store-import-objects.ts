import { MigrationInterface, QueryRunner } from 'typeorm';
export class StoreImportObjects1793051000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE product_imports ALTER COLUMN file DROP NOT NULL;
      ALTER TABLE product_imports ADD COLUMN object_key text, ADD COLUMN file_size integer;
      ALTER TABLE product_imports ADD CONSTRAINT import_file_location CHECK (
        (file IS NOT NULL AND object_key IS NULL AND file_size IS NULL) OR
        (file IS NULL AND object_key IS NOT NULL AND file_size IS NOT NULL AND file_size BETWEEN 1 AND 10000000));`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      "DO $$ BEGIN IF EXISTS (SELECT 1 FROM product_imports WHERE object_key IS NOT NULL) THEN RAISE EXCEPTION 'Object-backed imports exist; restore their originals before rollback'; END IF; END $$",
    );
    await q.query(
      'ALTER TABLE product_imports DROP CONSTRAINT import_file_location, DROP COLUMN object_key, DROP COLUMN file_size; ALTER TABLE product_imports ALTER COLUMN file SET NOT NULL',
    );
  }
}
