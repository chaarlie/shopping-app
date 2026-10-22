import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Product } from '@shop/contracts';
import { NotFoundError } from '../../../common/errors.js';
import { ProductEntity } from '../../entities/product.entity.js';
import { toProduct } from '../../product.mapper.js';
import { GetProductQuery } from '../get-product.query.js';

@QueryHandler(GetProductQuery)
export class GetProductQueryHandler implements IQueryHandler<GetProductQuery> {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async execute({ id }: GetProductQuery): Promise<Product> {
    const product = await this.txHost.tx
      .getRepository(ProductEntity)
      .findOneBy({ id });

    if (!product) {
      throw new NotFoundError(`Product ${id} was not found`);
    }

    return toProduct(product);
  }
}
