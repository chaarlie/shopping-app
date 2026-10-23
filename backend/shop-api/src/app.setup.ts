import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api', { exclude: ['webhooks/payments'] });
  app.use(cookieParser());

  return app;
}
