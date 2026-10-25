import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { createHash } from 'node:crypto';
import type { ImportSummary } from '@shop/contracts';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors.js';
import {
  planProductImport,
  type ProductImportPlan,
} from '../../../products/import/plan-product-import.js';
import {
  catalogHash,
  planStoredRows,
  type CatalogProduct,
} from '../../import-planner.js';
import { ImportRepository } from '../../repositories/import.repository.js';
import { ImportCommand } from '../import.command.js';

@CommandHandler(ImportCommand)
export class ImportCommandHandler implements ICommandHandler<ImportCommand> {
  constructor(private readonly imports: ImportRepository) {}
  @Transactional()
  async execute({ adminId, action }: ImportCommand): Promise<ImportSummary> {
    let id: number;
    if (action.kind === 'upload') {
      if (action.file.length > 1000000 || action.file.length === 0) {
        throw new ValidationError('Choose a non-empty CSV file up to 1 MB');
      }
      let plan: ProductImportPlan = {
        totalRows: 0,
        blankRows: 0,
        ignoredColumns: [],
        rows: [],
      };
      let fileError: string | null = null;
      try {
        plan = planProductImport(action.file.toString('utf8'));
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw error;
        }
        fileError = error.message;
      }
      const inserted = await this.imports.query<{ id: number }[]>(
        'INSERT INTO product_imports(filename,file,sha256,uploaded_by,total_rows,blank_rows,file_error) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [
          action.filename,
          action.file,
          createHash('sha256').update(action.file).digest('hex'),
          adminId,
          plan.totalRows,
          plan.blankRows,
          fileError,
        ],
      );
      id = inserted[0].id;
      for (const row of plan.rows) {
        await this.imports.query(
          "INSERT INTO product_import_rows(import_id,row_number,values,original_errors,result) VALUES($1,$2,$3,$4,'{}')",
          [
            id,
            row.row,
            JSON.stringify(row.values),
            JSON.stringify(row.errors.filter((e) => e.startsWith('Expected '))),
          ],
        );
      }
    } else {
      id = action.id;
    }
    const stored = await this.imports.lock(id);
    if (!stored) {
      throw new NotFoundError('Import not found');
    }
    if (stored.file_error) {
      if (action.kind === 'upload') {
        return (await this.imports.summary(id))!;
      }
      throw new ValidationError(
        'This file could not be parsed. Correct it and upload a new file.',
      );
    }
    if (action.kind === 'apply' && stored.applied_at) {
      return (await this.imports.summary(id))!;
    }
    if (action.kind !== 'upload' && stored.version !== action.version) {
      throw new ConflictError(
        'This import changed. Reload the preview before continuing.',
      );
    }
    if (stored.applied_at) {
      if (action.kind === 'apply') {
        return (await this.imports.summary(id))!;
      }
      throw new ConflictError('Applied imports cannot be edited');
    }
    if (action.kind === 'edit') {
      const rows = await this.imports.rows(id);
      const row = rows.find((r) => r.row_number === action.row);
      if (!row) {
        throw new NotFoundError('Import row not found');
      }
      const values = action.values ?? row.values;
      const excluded = action.excluded ?? row.excluded;
      await this.imports.query(
        'INSERT INTO product_import_edits(import_id,row_number,admin_id,before_value,after_value) VALUES($1,$2,$3,$4,$5)',
        [
          id,
          action.row,
          adminId,
          JSON.stringify({ values: row.values, excluded: row.excluded }),
          JSON.stringify({ values, excluded }),
        ],
      );
      await this.imports.query(
        'UPDATE product_import_rows SET values=$3,excluded=$4,edited_by=$5,edited_at=now() WHERE import_id=$1 AND row_number=$2',
        [id, action.row, JSON.stringify(values), excluded, adminId],
      );
    }
    if (action.kind === 'refresh' && action.updateStock !== undefined) {
      await this.imports.query(
        'UPDATE product_imports SET update_stock=$2 WHERE id=$1',
        [id, action.updateStock],
      );
      stored.update_stock = action.updateStock;
    }
    if (action.kind === 'apply') {
      await this.imports.query(
        'LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE',
      );
    }
    const products = await this.imports.query<CatalogProduct[]>(
      'SELECT id,sku,name,description,category,price_cents AS "priceCents",stock,weight_grams AS "weightGrams",version FROM products ORDER BY id',
    );
    const hash = catalogHash(products);
    if (action.kind === 'apply' && stored.catalog_hash !== hash) {
      throw new ConflictError(
        'The catalog changed since this preview. Refresh and review the changes before applying.',
      );
    }
    const plan = planStoredRows(
      await this.imports.rows(id),
      products,
      stored.update_stock,
    );
    if (action.kind === 'apply') {
      if (
        plan.results.some((row) =>
          row.errors.some((e) => e.includes('appears on rows')),
        )
      ) {
        throw new ConflictError(
          'Resolve conflicting SKUs before applying: keep one row, edit the SKUs, or exclude the conflicting rows.',
        );
      }
      for (const row of plan.matched) {
        const p = row.product;
        if (!p) {
          continue;
        }
        if (row.status === 'create') {
          await this.imports.query(
            'INSERT INTO products(sku,name,description,category,price_cents,stock,weight_grams) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              p.sku,
              p.name,
              p.description,
              p.category,
              p.priceCents,
              p.stock,
              p.weightGrams,
            ],
          );
        }
        if (row.status === 'update') {
          await this.imports.query(
            'UPDATE products SET name=$2,description=$3,category=$4,price_cents=$5,stock=$6,weight_grams=$7,version=version+1,updated_at=now() WHERE id=$1',
            [
              row.existingId,
              p.name,
              p.description,
              p.category,
              p.priceCents,
              p.stock,
              p.weightGrams,
            ],
          );
        }
      }
      await this.imports.query(
        'UPDATE product_imports SET applied_at=now(),applied_by=$2 WHERE id=$1',
        [id, adminId],
      );
    }
    for (const row of plan.results) {
      await this.imports.query(
        'UPDATE product_import_rows SET result=$3 WHERE import_id=$1 AND row_number=$2',
        [id, row.row, JSON.stringify(row)],
      );
    }
    await this.imports.query(
      'UPDATE product_imports SET catalog_hash=$2,counts=$3,version=version+1 WHERE id=$1',
      [id, hash, JSON.stringify(plan.counts)],
    );
    return (await this.imports.summary(id))!;
  }
}
