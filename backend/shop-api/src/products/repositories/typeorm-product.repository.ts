import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TypeOrmGenericRepository } from '../../database/repository/typeorm/typeorm-generic.repository.js';
import { ProductEntity } from '../entities/product.entity.js';
import {
  NewProduct,
  ProductChanges,
  ProductRepository,
} from './product.repository.js';

@Injectable()
export class TypeOrmProductRepository
  extends TypeOrmGenericRepository<ProductEntity, NewProduct>
  implements ProductRepository
{
  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost, ProductEntity);
  }

  async updateIfVersionMatches(
    id: number,
    version: number,
    changes: ProductChanges,
  ): Promise<ProductEntity | null> {
    const { affected } = await this.repository
      .createQueryBuilder()
      .update(ProductEntity)
      .set(changes)
      .where('id = :id AND version = :version', { id, version })
      .execute();

    return affected === 1 ? this.findById(id) : null;
  }
}
