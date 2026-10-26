import { ProductImportWriter } from '../../../products/import/product-import-writer.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
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
import { catalogHash, planStoredRows } from '../../import-planner.js';
import { ImportRepository } from '../../repositories/import.repository.js';
import { ImportCommand } from '../import.command.js';

@CommandHandler(ImportCommand)
export class ImportCommandHandler implements ICommandHandler<ImportCommand> {
  constructor(
    private readonly imports: ImportRepository,
    private readonly writer: ProductImportWriter,
  ) {}
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
      id = await this.imports.createUpload(
        action.filename,
        action.file,
        adminId,
        plan,
        fileError,
      );
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
      await this.imports.editRow(id, row, values, excluded, adminId);
    }
    if (action.kind === 'refresh' && action.updateStock !== undefined) {
      await this.imports.setStockPolicy(id, action.updateStock);
      stored.update_stock = action.updateStock;
    }
    if (action.kind === 'apply') {
      await this.imports.lockCatalog();
    }
    const products = await this.imports.catalog();
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
      await this.writer.apply(plan.matched);
      await this.imports.markApplied(id, adminId);
    }
    await this.imports.savePlan(id, plan.results, plan.counts, hash);
    return (await this.imports.summary(id))!;
  }
}
