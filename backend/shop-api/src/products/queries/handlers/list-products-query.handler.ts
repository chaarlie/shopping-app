import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ProductPage } from '@shop/contracts';
import { ProductEntity } from '../../entities/product.entity.js';
import { toProduct } from '../../product.mapper.js';
import { ListProductsQuery } from '../list-products.query.js';

@QueryHandler(ListProductsQuery)
export class ListProductsQueryHandler implements IQueryHandler<ListProductsQuery> {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async execute({ filters }: ListProductsQuery): Promise<ProductPage> {
    const { page, pageSize, category } = filters;
    const query = this.txHost.tx
      .getRepository(ProductEntity)
      .createQueryBuilder('product')
      .orderBy('product.name', 'ASC')
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
