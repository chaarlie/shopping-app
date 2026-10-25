import { Query } from '@nestjs/cqrs';
import { ProductPage, ProductSearchQuery } from '@shop/contracts';

export class ListProductsQuery extends Query<ProductPage> {
  constructor(public readonly filters: ProductSearchQuery) {
    super();
  }
}
