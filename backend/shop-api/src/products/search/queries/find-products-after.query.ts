import { Query } from '@nestjs/cqrs';
import { ProductEntity } from '../../entities/product.entity.js';

export class FindProductsAfterQuery extends Query<ProductEntity[]> {
  constructor(
    public readonly afterId: number,
    public readonly limit: number,
  ) {
    super();
  }
}
