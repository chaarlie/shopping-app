import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Admin } from '@shop/contracts';
import { AdminRepository } from './admin.repository.js';
import { sessionHash } from '../passwords.js';

@Injectable()
export class TypeOrmAdminRepository extends AdminRepository {
  constructor(
    private readonly host: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {
    super();
  }
  async findEmail(
    email: string,
  ): Promise<(Admin & { password_hash: string }) | undefined> {
    const rows = await this.host.tx.query<
      (Admin & { password_hash: string })[]
    >('SELECT id, name, email, password_hash FROM admins WHERE email = $1', [
      email,
    ]);
    return rows[0];
  }
  async findSession(token: string): Promise<Admin | undefined> {
    const rows = await this.host.tx.query<Admin[]>(
      'SELECT a.id, a.name, a.email FROM admins a JOIN admin_sessions s ON s.admin_id=a.id WHERE s.token_hash=$1 AND s.expires_at>now()',
      [sessionHash(token)],
    );
    return rows[0];
  }
  async createSession(token: string, adminId: number): Promise<void> {
    await this.host.tx.query(
      'DELETE FROM admin_sessions WHERE expires_at <= now()',
    );
    await this.host.tx.query(
      "INSERT INTO admin_sessions (token_hash,admin_id,expires_at) VALUES ($1,$2,now()+interval '8 hours')",
      [sessionHash(token), adminId],
    );
  }
  async deleteSession(token: string): Promise<void> {
    await this.host.tx.query('DELETE FROM admin_sessions WHERE token_hash=$1', [
      sessionHash(token),
    ]);
  }
}
