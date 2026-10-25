import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AdminRequest } from './admin/access.js';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api', { exclude: ['webhooks/payments'] });
  app.use(cookieParser());
  const logger = new Logger('Request');
  app.use((req: AdminRequest, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const start = Date.now();
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () =>
      logger.log({
        requestId,
        adminId: req.admin?.id ?? null,
        method: req.method,
        path: req.path,
        status: response.statusCode,
        durationMs: Date.now() - start,
      }),
    );
    next();
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  return app;
}
