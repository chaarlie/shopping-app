import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { CategoryList } from '@shop/contracts';
import { ListCategoriesQuery } from '../list-categories.query.js';

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesQueryHandler implements IQueryHandler<ListCategoriesQuery> {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async execute(): Promise<CategoryList> {
    const items = await this.txHost.tx.query<
      { name: string; productCount: number }[]
    >(`
      SELECT category AS name, count(*)::int AS "productCount"
      FROM products
      GROUP BY category
      ORDER BY category
    `);

    return { items };
  }
}
