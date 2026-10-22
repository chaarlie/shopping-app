import { Query } from '@nestjs/cqrs';
import { ProductListQuery, ProductPage } from '@shop/contracts';

export class ListProductsQuery extends Query<ProductPage> {
  constructor(public readonly filters: ProductListQuery) {
    super();
  }
}
