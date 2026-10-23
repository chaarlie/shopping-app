import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signatureHeader, verifySignature } from '@shop/webhook-signature';
import { Request } from 'express';
import { Env } from '../../config/env.schema.js';

@Injectable()
export class PaymentWebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(PaymentWebhookSignatureGuard.name);
  private readonly secret: string;

  constructor(configService: ConfigService<Env, true>) {
    this.secret = configService.get('PAYMENT_WEBHOOK_SECRET', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const check = verifySignature(
      request.rawBody ?? Buffer.alloc(0),
      request.header(signatureHeader),
      this.secret,
    );

    if (!check.valid) {
      this.logger.warn(`Refused a payment webhook: ${check.reason} signature`);
      throw new UnauthorizedException();
    }

    return true;
  }
}
