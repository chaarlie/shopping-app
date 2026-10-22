import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = setupApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const port = configService.get('PORT', { infer: true });

  await app.listen(port);
  new Logger('Bootstrap').log(`shop-api listening on port ${port}`);
}
await bootstrap();
