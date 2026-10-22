import { Command } from '@nestjs/cqrs';
import { ProductImportOptions, ProductImportReport } from '@shop/contracts';

export class ImportProductsCommand extends Command<ProductImportReport> {
  constructor(
    public readonly csv: string,
    public readonly options: ProductImportOptions,
  ) {
    super();
  }
}
