import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateProductCommandHandler } from './commands/handlers/create-product-command.handler.js';
import { DeleteProductCommandHandler } from './commands/handlers/delete-product-command.handler.js';
import { ImportProductsCommandHandler } from './commands/handlers/import-products-command.handler.js';
import { UpdateProductCommandHandler } from './commands/handlers/update-product-command.handler.js';
import { CategoriesController } from './controllers/categories.controller.js';
import { ProductsImportController } from './controllers/products-import.controller.js';
import { ProductsRestController } from './controllers/products-rest.controller.js';
import { ProductEntity } from './entities/product.entity.js';
import { GetProductQueryHandler } from './queries/handlers/get-product-query.handler.js';
import { ListCategoriesQueryHandler } from './queries/handlers/list-categories-query.handler.js';
import { ListProductsQueryHandler } from './queries/handlers/list-products-query.handler.js';
import { ProductRepository } from './repositories/product.repository.js';
import { TypeOrmProductRepository } from './repositories/typeorm-product.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  controllers: [
    ProductsImportController,
    ProductsRestController,
    CategoriesController,
  ],
  providers: [
    {
      provide: ProductRepository,
      useClass: TypeOrmProductRepository,
    },
    CreateProductCommandHandler,
    UpdateProductCommandHandler,
    DeleteProductCommandHandler,
    ImportProductsCommandHandler,
    GetProductQueryHandler,
    ListProductsQueryHandler,
    ListCategoriesQueryHandler,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
