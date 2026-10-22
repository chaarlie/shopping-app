import { GenericRepository } from '../../database/repository/generic/generic-repository.abstract.js';
import { ProductEntity } from '../entities/product.entity.js';

export type NewProduct = Pick<
  ProductEntity,
  | 'sku'
  | 'name'
  | 'description'
  | 'category'
  | 'priceCents'
  | 'stock'
  | 'weightGrams'
>;

export type ProductChanges = Partial<Omit<NewProduct, 'sku'>>;

export abstract class ProductRepository extends GenericRepository<
  ProductEntity,
  NewProduct
> {
  abstract updateIfVersionMatches(
    id: number,
    version: number,
    changes: ProductChanges,
  ): Promise<ProductEntity | null>;
}
