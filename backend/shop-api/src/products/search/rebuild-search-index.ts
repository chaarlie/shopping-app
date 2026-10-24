import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

process.env.BACKGROUND_JOBS = 'off';

const { AppModule } = await import('../../app.module.js');
const { ProductSearchRebuilder } =
  await import('./product-search-rebuilder.js');

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['log', 'warn', 'error'],
});

try {
  const { index, products, replaced } = await app
    .get(ProductSearchRebuilder)
    .rebuild();

  new Logger('SearchIndex').log(
    `Rebuilt ${index} with ${products} products${replaced ? `, replacing ${replaced}` : ''}`,
  );
} finally {
  await app.close();
}
