import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { Env } from '../../config/env.schema.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expectedDigest: Buffer;

  constructor(
    private readonly reflector: Reflector,
    configService: ConfigService<Env, true>,
  ) {
    this.expectedDigest = digest(
      configService.get('PAYMENTS_API_KEY', { infer: true }),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (
      scheme !== 'Bearer' ||
      !token ||
      !timingSafeEqual(digest(token), this.expectedDigest)
    ) {
      throw new UnauthorizedException();
    }

    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
