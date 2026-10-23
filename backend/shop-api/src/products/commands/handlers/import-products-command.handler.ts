import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import {
  CreateProductInput,
  ProductImportReport,
  ProductImportStatus,
} from '@shop/contracts';
import {
  MatchedProductRow,
  matchExistingProducts,
} from '../../import/match-existing-products.js';
import {
  planProductImport,
  ProductImportPlan,
} from '../../import/plan-product-import.js';
import { ProductRepository } from '../../repositories/product.repository.js';
import { ImportProductsCommand } from '../import-products.command.js';

@CommandHandler(ImportProductsCommand)
export class ImportProductsCommandHandler implements ICommandHandler<ImportProductsCommand> {
  constructor(private readonly products: ProductRepository) {}

  @Transactional()
  async execute({
    csv,
    options,
  }: ImportProductsCommand): Promise<ProductImportReport> {
    const plan = planProductImport(csv);
    const readySkus = plan.rows.flatMap((row) =>
      row.status === 'ready' && row.product ? [row.product.sku] : [],
    );

    const existing = await this.products.findBySkusForUpdate(readySkus);
    const rows = matchExistingProducts(
      plan.rows,
      new Map(existing.map((product) => [product.sku, product])),
      options.onExisting,
    );

    if (!options.dryRun) {
      await this.apply(rows);
    }

    return toReport(plan, rows, options.dryRun);
  }

  private async apply(rows: MatchedProductRow[]): Promise<void> {
    await this.products.createMany(
      rows.flatMap((row) =>
        row.status === 'create' && row.product ? [row.product] : [],
      ),
    );

    for (const row of rows) {
      if (row.status === 'update' && row.product && row.existingId !== null) {
        await this.products.update(row.existingId, changesFrom(row.product));
      }
    }
  }
}

function changesFrom(product: CreateProductInput) {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    stock: product.stock,
    weightGrams: product.weightGrams,
  };
}

function toReport(
  plan: ProductImportPlan,
  rows: MatchedProductRow[],
  dryRun: boolean,
): ProductImportReport {
  const counts: Record<ProductImportStatus, number> = {
    create: 0,
    update: 0,
    unchanged: 0,
    skip: 0,
    duplicate: 0,
    error: 0,
  };

  for (const row of rows) {
    counts[row.status] += 1;
  }

  return {
    dryRun,
    totalRows: plan.totalRows,
    blankRows: plan.blankRows,
    ignoredColumns: plan.ignoredColumns,
    counts,
    rows: rows.map(({ row, status, values, errors, warnings }) => ({
      row,
      status,
      values,
      errors,
      warnings,
    })),
  };
}
