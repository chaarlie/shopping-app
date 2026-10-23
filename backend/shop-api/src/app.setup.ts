import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api');
  app.use(cookieParser());

  return app;
}
