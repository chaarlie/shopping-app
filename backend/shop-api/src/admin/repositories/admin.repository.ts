import type { Admin } from '@shop/contracts';
export abstract class AdminRepository {
  abstract findEmail(
    email: string,
  ): Promise<(Admin & { password_hash: string }) | undefined>;
  abstract findSession(token: string): Promise<Admin | undefined>;
  abstract createSession(token: string, adminId: number): Promise<void>;
  abstract deleteSession(token: string): Promise<void>;
}
