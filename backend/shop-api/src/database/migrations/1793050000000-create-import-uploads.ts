import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateImportUploads1793050000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE import_uploads (
      id uuid PRIMARY KEY, admin_id integer NOT NULL REFERENCES admins(id), filename text NOT NULL,
      size bigint NOT NULL CHECK(size BETWEEN 1 AND 10000000), object_key text NOT NULL UNIQUE,
      multipart_id text, state text NOT NULL DEFAULT 'starting' CHECK(state IN ('starting','uploading','completing','queued','processing','ready','failed','cancelled')),
      import_id integer REFERENCES product_imports(id), error text,
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
      lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
      cleaned_at timestamptz,
      CHECK ((lease_token IS NULL) = (lease_until IS NULL))
    ); CREATE INDEX import_upload_jobs ON import_uploads(state,lease_until,created_at)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE import_uploads');
  }
}
