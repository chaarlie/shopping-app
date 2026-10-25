import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CategoryList } from '@shop/contracts';
import { ProductRepository } from '../../repositories/product.repository.js';
import { ListCategoriesQuery } from '../list-categories.query.js';

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesQueryHandler implements IQueryHandler<ListCategoriesQuery> {
  constructor(private readonly products: ProductRepository) {}

  async execute(): Promise<CategoryList> {
    return { items: await this.products.listCategories() };
  }
}
