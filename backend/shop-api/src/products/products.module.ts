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
import { ClaimProductSearchChangesCommandHandler } from './search/commands/handlers/claim-product-search-changes-command.handler.js';
import { CompleteProductSearchChangesCommandHandler } from './search/commands/handlers/complete-product-search-changes-command.handler.js';
import { QueueAllProductsForSearchCommandHandler } from './search/commands/handlers/queue-all-products-for-search-command.handler.js';
import { OpenSearchProductSearchIndex } from './search/opensearch-product-search-index.js';
import { ProductSearchIndex } from './search/product-search-index.js';
import { ProductSearchIndexerJob } from './search/product-search-indexer.job.js';
import { ProductSearchOutbox } from './search/product-search-outbox.js';
import { ProductSearchRebuilder } from './search/product-search-rebuilder.js';
import { FindProductsAfterQueryHandler } from './search/queries/handlers/find-products-after-query.handler.js';
import { FindProductsByIdsQueryHandler } from './search/queries/handlers/find-products-by-ids-query.handler.js';
import { TypeOrmProductSearchOutbox } from './search/typeorm-product-search-outbox.js';

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
    {
      provide: ProductSearchIndex,
      useClass: OpenSearchProductSearchIndex,
    },
    {
      provide: ProductSearchOutbox,
      useClass: TypeOrmProductSearchOutbox,
    },
    CreateProductCommandHandler,
    UpdateProductCommandHandler,
    DeleteProductCommandHandler,
    ImportProductsCommandHandler,
    ClaimProductSearchChangesCommandHandler,
    CompleteProductSearchChangesCommandHandler,
    QueueAllProductsForSearchCommandHandler,
    GetProductQueryHandler,
    ListProductsQueryHandler,
    ListCategoriesQueryHandler,
    FindProductsByIdsQueryHandler,
    FindProductsAfterQueryHandler,
    ProductSearchIndexerJob,
    ProductSearchRebuilder,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
