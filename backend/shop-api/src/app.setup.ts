import { INestApplication } from '@nestjs/common';

export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api');

  return app;
}
