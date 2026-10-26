import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateImportPortal1792886500000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE product_imports (id SERIAL PRIMARY KEY, filename text NOT NULL, file bytea NOT NULL CHECK(octet_length(file)<=1000000), sha256 char(64) NOT NULL, uploaded_by integer NOT NULL REFERENCES admins(id), uploaded_at timestamptz NOT NULL DEFAULT now(), applied_by integer REFERENCES admins(id), applied_at timestamptz, version integer NOT NULL DEFAULT 1, update_stock boolean NOT NULL DEFAULT false, catalog_hash text NOT NULL DEFAULT '', counts jsonb NOT NULL DEFAULT '{}', total_rows integer NOT NULL, blank_rows integer NOT NULL); CREATE TABLE product_import_rows (import_id integer NOT NULL REFERENCES product_imports(id), row_number integer NOT NULL, values jsonb NOT NULL, original_errors jsonb NOT NULL, excluded boolean NOT NULL DEFAULT false, edited_by integer REFERENCES admins(id), edited_at timestamptz, result jsonb NOT NULL, PRIMARY KEY(import_id,row_number)); CREATE TABLE product_import_edits (id SERIAL PRIMARY KEY, import_id integer NOT NULL REFERENCES product_imports(id), row_number integer NOT NULL, admin_id integer NOT NULL REFERENCES admins(id), edited_at timestamptz NOT NULL DEFAULT now(), before_value jsonb NOT NULL, after_value jsonb NOT NULL); CREATE INDEX product_import_history ON product_imports(uploaded_at DESC,id DESC)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE product_import_edits; DROP TABLE product_import_rows; DROP TABLE product_imports',
    );
  }
}
