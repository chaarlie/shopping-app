import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ListAdminProductsQuery } from '../list-admin-products.query.js';
import { ProductEntity } from '../../entities/product.entity.js';
import { toProduct } from '../../product.mapper.js';
@QueryHandler(ListAdminProductsQuery)
export class ListAdminProductsQueryHandler implements IQueryHandler<ListAdminProductsQuery> {
  constructor(
    private readonly host: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}
  async execute({ page, pageSize, q, reorder }: ListAdminProductsQuery) {
    const query = this.host.tx
      .getRepository(ProductEntity)
      .createQueryBuilder('p');
    if (q) {
      query.andWhere('(p.name ILIKE :q OR p.sku ILIKE :q)', {
        q: `%${q.replace(/[\\%_]/g, '\\$&')}%`,
      });
    }
    if (reorder) {
      query.andWhere('p.stock=0');
    }
    const [rows, total] = await query
      .orderBy('p.name', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items: rows.map(toProduct), total, page, pageSize };
  }
}
