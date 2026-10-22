import { Product } from '@shop/contracts';
import { ProductEntity } from './entities/product.entity.js';

export function toProduct(entity: ProductEntity): Product {
  return {
    id: entity.id,
    sku: entity.sku,
    name: entity.name,
    description: entity.description,
    category: entity.category,
    priceCents: entity.priceCents,
    stock: entity.stock,
    weightGrams: entity.weightGrams,
    version: entity.version,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
