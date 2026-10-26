import { Command } from '@nestjs/cqrs';
import type { ImportSummary } from '@shop/contracts';
import type { ProductCsvValues } from '../../products/import/product-csv.js';
export type ImportAction =
  | { kind: 'upload'; filename: string; file: Buffer }
  | {
      kind: 'edit';
      id: number;
      version: number;
      row: number;
      values?: ProductCsvValues;
      excluded?: boolean;
    }
  | {
      kind: 'refresh' | 'apply';
      id: number;
      version: number;
      updateStock?: boolean;
    };
export class ImportCommand extends Command<ImportSummary> {
  constructor(
    public readonly adminId: number,
    public readonly action: ImportAction,
  ) {
    super();
  }
}
