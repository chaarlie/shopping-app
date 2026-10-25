import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ProductPage, ProductSort } from '@shop/contracts';
import { ProductEntity } from '../../entities/product.entity.js';
import { toProduct } from '../../product.mapper.js';
import { ListProductsQuery } from '../list-products.query.js';

const orderings: Record<ProductSort, [string, 'ASC' | 'DESC']> = {
  relevance: ['product.name', 'ASC'],
  name: ['product.name', 'ASC'],
  price_asc: ['product.priceCents', 'ASC'],
  price_desc: ['product.priceCents', 'DESC'],
  newest: ['product.createdAt', 'DESC'],
};

@QueryHandler(ListProductsQuery)
export class ListProductsQueryHandler implements IQueryHandler<ListProductsQuery> {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async execute({ filters }: ListProductsQuery): Promise<ProductPage> {
    const { page, pageSize, category, sort = 'name' } = filters;
    const [column, direction] = orderings[sort];
    const query = this.txHost.tx
      .getRepository(ProductEntity)
      .createQueryBuilder('product')
      .orderBy(column, direction)
      .addOrderBy('product.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (category) {
      query.andWhere('product.category = :category', { category });
    }

    const [products, total] = await query.getManyAndCount();

    return { items: products.map(toProduct), page, pageSize, total };
  }
}
