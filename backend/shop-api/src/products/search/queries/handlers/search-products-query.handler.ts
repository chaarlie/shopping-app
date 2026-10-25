import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProductPage } from '@shop/contracts';
import { toProduct } from '../../../product.mapper.js';
import { ProductRepository } from '../../../repositories/product.repository.js';
import { ProductSearchIndex } from '../../product-search-index.js';
import { SearchProductsQuery } from '../search-products.query.js';

@QueryHandler(SearchProductsQuery)
export class SearchProductsQueryHandler implements IQueryHandler<SearchProductsQuery> {
  constructor(
    private readonly index: ProductSearchIndex,
    private readonly products: ProductRepository,
  ) {}

  async execute({ query }: SearchProductsQuery): Promise<ProductPage> {
    const { ids, total } = await this.index.search(query);
    const current = new Map(
      (await this.products.findByIds(ids)).map((product) => [
        product.id,
        product,
      ]),
    );

    return {
      items: ids.flatMap((id) => {
        const product = current.get(id);
        return product ? [toProduct(product)] : [];
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
