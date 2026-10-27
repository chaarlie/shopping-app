import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../repositories/product.repository.js';
import type { MatchedProductRow } from './match-existing-products.js';
import { ConflictError } from '../../common/errors.js';
import { isUniqueViolation } from '../../database/errors.js';
@Injectable()
export class ProductImportWriter {
  constructor(private readonly products: ProductRepository) {}
  async apply(rows: MatchedProductRow[]): Promise<void> {
    try {
      await this.products.createMany(
        rows.flatMap((row) =>
          row.status === 'create' && row.product ? [row.product] : [],
        ),
      );
      for (const row of rows) {
        if (row.status === 'update' && row.product && row.existingId !== null) {
          const { sku: _sku, ...changes } = row.product;
          await this.products.update(row.existingId, changes);
        }
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'The catalog changed during import. Preview the file again.',
        );
      }
      throw error;
    }
  }
}
