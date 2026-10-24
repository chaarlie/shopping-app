import { Query } from '@nestjs/cqrs';
import { ProductEntity } from '../../entities/product.entity.js';

export class FindProductsByIdsQuery extends Query<ProductEntity[]> {
  constructor(public readonly ids: number[]) {
    super();
  }
}
