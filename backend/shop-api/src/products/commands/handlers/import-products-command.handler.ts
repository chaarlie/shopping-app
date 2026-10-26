import { ProductImportWriter } from '../../import/product-import-writer.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ProductImportReport, ProductImportStatus } from '@shop/contracts';
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
  constructor(
    private readonly products: ProductRepository,
    private readonly writer: ProductImportWriter,
  ) {}

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
      plan.rows.map((row) => {
        const current =
          row.product &&
          existing.find((product) => product.sku === row.product?.sku);
        return !options.updateStock && row.product && current
          ? { ...row, product: { ...row.product, stock: current.stock } }
          : row;
      }),
      new Map(existing.map((product) => [product.sku, product])),
      options.onExisting,
    );

    if (!options.dryRun) {
      await this.writer.apply(rows);
    }

    return toReport(plan, rows, options.dryRun);
  }
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
