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

export interface CategoryCount {
  name: string;
  productCount: number;
}

export abstract class ProductRepository extends GenericRepository<
  ProductEntity,
  NewProduct
> {
  abstract updateIfVersionMatches(
    id: number,
    version: number,
    changes: ProductChanges,
  ): Promise<ProductEntity | null>;

  abstract findBySkusForUpdate(skus: string[]): Promise<ProductEntity[]>;

  abstract findByIdsForUpdate(ids: number[]): Promise<ProductEntity[]>;

  abstract findByIds(ids: number[]): Promise<ProductEntity[]>;

  abstract changeStock(id: number, delta: number): Promise<boolean>;

  abstract createMany(products: NewProduct[]): Promise<void>;

  abstract listCategories(): Promise<CategoryCount[]>;
}
