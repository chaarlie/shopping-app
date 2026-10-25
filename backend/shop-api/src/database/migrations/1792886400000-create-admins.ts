import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateAdmins1792886400000 implements MigrationInterface {
  async up(query: QueryRunner): Promise<void> {
    await query.query(
      `CREATE TABLE admins (id SERIAL PRIMARY KEY, name varchar(200) NOT NULL, email varchar(254) UNIQUE NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE admin_sessions (token_hash char(64) PRIMARY KEY, admin_id integer NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL); CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at)`,
    );
  }
  async down(query: QueryRunner): Promise<void> {
    await query.query('DROP TABLE admin_sessions; DROP TABLE admins');
  }
}
