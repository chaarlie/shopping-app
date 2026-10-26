import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../common/errors.js';
import { ProductRepository } from '../products/repositories/product.repository.js';
import {
  ImportRepository,
  StoredImport,
} from './repositories/import.repository.js';
import { catalogHash, planStoredRows } from './import-planner.js';
@Injectable()
export class ImportReview {
  constructor(
    private readonly imports: ImportRepository,
    private readonly products: ProductRepository,
  ) {}
  async lock(id: number) {
    const stored = await this.imports.lock(id);
    if (!stored) {
      throw new NotFoundError('Import not found');
    }
    return stored;
  }
  assertEditable(stored: StoredImport, version: number) {
    if (stored.file_error) {
      throw new ValidationError(
        'This file could not be parsed. Correct it and upload a new file.',
      );
    }
    if (stored.version !== version) {
      throw new ConflictError(
        'This import changed. Reload the preview before continuing.',
      );
    }
    if (stored.applied_at) {
      throw new ConflictError('Applied imports cannot be edited');
    }
  }
  async prepare(id: number, updateStock: boolean, lockProducts = false) {
    const rows = await this.imports.rows(id);
    const skus = [
      ...new Set(
        rows
          .filter((row) => !row.excluded)
          .map((row) => row.values.sku.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    const products = lockProducts
      ? await this.products.findBySkusForUpdate(skus)
      : await this.products.findBySkus(skus);
    return {
      ...planStoredRows(rows, products, updateStock),
      hash: catalogHash(products, updateStock),
    };
  }
  async save(id: number, plan: Awaited<ReturnType<ImportReview['prepare']>>) {
    await this.imports.savePlan(id, plan.results, plan.counts, plan.hash);
    return this.summary(id);
  }
  async summary(id: number) {
    const summary = await this.imports.summary(id);
    if (!summary) {
      throw new NotFoundError('Import not found');
    }
    return summary;
  }
}
