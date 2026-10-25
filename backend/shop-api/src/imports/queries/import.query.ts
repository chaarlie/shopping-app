import { Query } from '@nestjs/cqrs';
import type { ImportPreview, ImportSummary } from '@shop/contracts';
export class ImportPreviewQuery extends Query<ImportPreview> {
  constructor(
    public readonly id: number,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly status: string,
    public readonly sku?: string,
  ) {
    super();
  }
}
export class ImportHistoryQuery extends Query<{
  items: ImportSummary[];
  page: number;
  pageSize: number;
  total: number;
}> {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
  ) {
    super();
  }
}
export class ImportDownloadQuery extends Query<{
  filename: string;
  file: Buffer;
}> {
  constructor(public readonly id: number) {
    super();
  }
}
