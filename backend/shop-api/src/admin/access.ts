import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Admin } from '@shop/contracts';
import type { Request } from 'express';
import { AdminRepository } from './repositories/admin.repository.js';
import type { Env } from '../config/env.schema.js';
export const Public = () => SetMetadata('public', true);
export const SignedWebhook = () => SetMetadata('signed-webhook', true);
export type AdminRequest = Request & { admin: Admin };
export const adminCookie = 'stockroom_admin';

@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly admins: AdminRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('signed-webhook', targets)) {
      return true;
    }
    const req = context.switchToHttp().getRequest<AdminRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = this.config.get('APP_ORIGIN', { infer: true }).split(',');
      if (origin && !allowed.includes(origin)) {
        throw new ForbiddenException(
          'Writes from another origin are not allowed',
        );
      }
      if (!origin && req.headers['sec-fetch-site'] === 'cross-site') {
        throw new ForbiddenException(
          'Writes from another origin are not allowed',
        );
      }
    }
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) {
      return true;
    }
    const token: unknown = req.cookies?.[adminCookie];
    const admin =
      typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
        ? await this.admins.findSession(token)
        : undefined;
    if (!admin) {
      throw new UnauthorizedException('Sign in as an admin to continue');
    }
    req.admin = admin;
    return true;
  }
}
