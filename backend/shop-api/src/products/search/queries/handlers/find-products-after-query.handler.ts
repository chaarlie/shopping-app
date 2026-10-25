import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProductEntity } from '../../../entities/product.entity.js';
import { ProductRepository } from '../../../repositories/product.repository.js';
import { FindProductsAfterQuery } from '../find-products-after.query.js';

@QueryHandler(FindProductsAfterQuery)
export class FindProductsAfterQueryHandler implements IQueryHandler<FindProductsAfterQuery> {
  constructor(private readonly products: ProductRepository) {}

  execute({
    afterId,
    limit,
  }: FindProductsAfterQuery): Promise<ProductEntity[]> {
    return this.products.findAfter(afterId, limit);
  }
}
