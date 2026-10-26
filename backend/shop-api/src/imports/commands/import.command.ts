import { Command } from '@nestjs/cqrs';
import type { ImportSummary } from '@shop/contracts';
import type { ProductCsvValues } from '../../products/import/product-csv.js';
export class UploadImportCommand extends Command<ImportSummary> {
  constructor(
    public readonly adminId: number,
    public readonly filename: string,
    public readonly file: Buffer,
  ) {
    super();
  }
}
export class EditImportRowCommand extends Command<ImportSummary> {
  constructor(
    public readonly adminId: number,
    public readonly id: number,
    public readonly row: number,
    public readonly input: {
      version: number;
      values?: ProductCsvValues;
      excluded?: boolean;
    },
  ) {
    super();
  }
}
export class RefreshImportCommand extends Command<ImportSummary> {
  constructor(
    public readonly id: number,
    public readonly version: number,
    public readonly updateStock?: boolean,
  ) {
    super();
  }
}
export class ApplyImportCommand extends Command<ImportSummary> {
  constructor(
    public readonly adminId: number,
    public readonly id: number,
    public readonly version: number,
  ) {
    super();
  }
}
