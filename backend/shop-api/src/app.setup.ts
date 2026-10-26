import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api', { exclude: ['webhooks/payments'] });
  app.use(cookieParser());

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  return app;
}
