import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, MoreThan } from 'typeorm';
import { TypeOrmGenericRepository } from '../../database/repository/typeorm/typeorm-generic.repository.js';
import { ProductEntity } from '../entities/product.entity.js';
import {
  CategoryCount,
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

  findBySkus(skus: string[]): Promise<ProductEntity[]> {
    if (!skus.length) {
      return Promise.resolve([]);
    }
    return this.repository.find({
      where: { sku: In(skus) },
      order: { id: 'ASC' },
    });
  }

  async findBySkusForUpdate(skus: string[]): Promise<ProductEntity[]> {
    if (skus.length === 0) {
      return [];
    }

    return this.repository
      .createQueryBuilder('product')
      .where('product.sku IN (:...skus)', { skus })
      .orderBy('product.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }

  async findByIdsForUpdate(ids: number[]): Promise<ProductEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.repository
      .createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids })
      .orderBy('product.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }

  findByIds(ids: number[]): Promise<ProductEntity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.findBy({ id: In(ids) });
  }

  findAfter(afterId: number, limit: number): Promise<ProductEntity[]> {
    return this.repository.find({
      where: { id: MoreThan(afterId) },
      order: { id: 'ASC' },
      take: limit,
    });
  }

  async changeStock(id: number, delta: number): Promise<boolean> {
    const { affected } = await this.repository
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ stock: () => 'stock + :delta' })
      .where('id = :id AND stock + :delta >= 0', { id, delta })
      .execute();

    return affected === 1;
  }

  async createMany(products: NewProduct[]): Promise<void> {
    if (products.length === 0) {
      return;
    }

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ProductEntity)
      .values(products)
      .execute();
  }

  listCategories(): Promise<CategoryCount[]> {
    return this.repository
      .createQueryBuilder('product')
      .select('product.category', 'name')
      .addSelect('CAST(COUNT(*) AS integer)', 'productCount')
      .groupBy('product.category')
      .orderBy('product.category', 'ASC')
      .getRawMany<CategoryCount>();
  }
}
