import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { NotFoundError } from '../../common/errors.js';
import { ORDER_ACCESS_COOKIE, OrderAccess } from './order-access.js';

@Injectable()
export class OrderAccessGuard implements CanActivate {
  constructor(private readonly access: OrderAccess) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const reference = String(request.params.reference).toUpperCase();
    const cookies = request.cookies as Record<string, unknown>;

    if (!this.access.isAllowed(reference, cookies[ORDER_ACCESS_COOKIE])) {
      throw new NotFoundError(`Order ${reference} was not found`);
    }

    return true;
  }
}
