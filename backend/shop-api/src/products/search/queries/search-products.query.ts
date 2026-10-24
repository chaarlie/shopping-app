import { Query } from '@nestjs/cqrs';
import { ProductPage, ProductSearchQuery } from '@shop/contracts';

export class SearchProductsQuery extends Query<ProductPage> {
  constructor(public readonly query: ProductSearchQuery) {
    super();
  }
}
