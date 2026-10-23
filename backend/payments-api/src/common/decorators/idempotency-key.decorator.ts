import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { idempotencyKeySchema } from '@shop/contracts';
import { Request } from 'express';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const result = idempotencyKeySchema.safeParse(
      request.headers['idempotency-key'],
    );

    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: result.error.issues[0].message,
      });
    }

    return result.data;
  },
);
