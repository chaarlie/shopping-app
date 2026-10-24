import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProductEntity } from '../../../entities/product.entity.js';
import { ProductRepository } from '../../../repositories/product.repository.js';
import { FindProductsByIdsQuery } from '../find-products-by-ids.query.js';

@QueryHandler(FindProductsByIdsQuery)
export class FindProductsByIdsQueryHandler implements IQueryHandler<FindProductsByIdsQuery> {
  constructor(private readonly products: ProductRepository) {}

  execute({ ids }: FindProductsByIdsQuery): Promise<ProductEntity[]> {
    return this.products.findByIds(ids);
  }
}
