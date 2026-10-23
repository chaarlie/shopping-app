import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Env } from '../../config/env.schema.js';
import {
  isOrderAccessToken,
  orderAccessToken,
} from '../domain/order-access-token.js';

export const ORDER_ACCESS_COOKIE = 'order_access';

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrderAccess {
  private readonly secret: string;
  private readonly secureCookie: boolean;

  constructor(configService: ConfigService<Env, true>) {
    this.secret = configService.get('ORDER_ACCESS_SECRET', { infer: true });
    this.secureCookie = configService.get('ORDER_COOKIE_SECURE', {
      infer: true,
    });
  }

  isAllowed(reference: string, token: unknown): boolean {
    return (
      typeof token === 'string' &&
      isOrderAccessToken(token, reference, this.secret)
    );
  }

  grant(response: Response, reference: string): void {
    response.cookie(
      ORDER_ACCESS_COOKIE,
      orderAccessToken(reference, this.secret),
      {
        httpOnly: true,
        sameSite: 'strict',
        secure: this.secureCookie,
        path: `/api/orders/${reference}`,
        maxAge: COOKIE_MAX_AGE_MS,
      },
    );
  }
}
