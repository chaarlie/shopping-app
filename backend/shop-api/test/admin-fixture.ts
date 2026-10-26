import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { sessionHash, hashPassword } from '../src/admin/passwords.js';
export const fixtureToken = 'ab'.repeat(32);
export async function seedAdmin(app: INestApplication): Promise<void> {
  const db = app.get(DataSource);
  const [admin] = await db.query<{ id: number }[]>(
    "INSERT INTO admins(name,email,password_hash) VALUES('Test Admin','test@example.test',$1) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash RETURNING id",
    [await hashPassword('test-password-123')],
  );
  await db.query(
    "INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '8 hours') ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at",
    [sessionHash(fixtureToken), admin.id],
  );
}
export function adminRequest(app: INestApplication) {
  return request
    .agent(app.getHttpServer())
    .set('Cookie', `stockroom_admin=${fixtureToken}`);
}
