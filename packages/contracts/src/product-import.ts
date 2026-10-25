import { z } from 'zod';

export const productCsvColumns = [
  'name',
  'sku',
  'description',
  'category',
  'price',
  'stock',
  'weight_kg',
] as const;

export type ProductCsvColumn = (typeof productCsvColumns)[number];

export const productImportOptionsSchema = z.strictObject({
  dryRun: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  updateStock: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  onExisting: z.enum(['update', 'skip']).default('update'),
});

export type ProductImportOptions = z.infer<typeof productImportOptionsSchema>;

export const productImportStatusSchema = z.enum([
  'create',
  'update',
  'unchanged',
  'skip',
  'duplicate',
  'error',
]);

export type ProductImportStatus = z.infer<typeof productImportStatusSchema>;

export const productImportRowSchema = z.object({
  row: z.number().int(),
  status: productImportStatusSchema,
  values: z.record(z.enum(productCsvColumns), z.string()),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ProductImportRow = z.infer<typeof productImportRowSchema>;

export const productImportReportSchema = z.object({
  dryRun: z.boolean(),
  totalRows: z.number().int(),
  blankRows: z.number().int(),
  ignoredColumns: z.array(z.string()),
  counts: z.record(productImportStatusSchema, z.number().int()),
  rows: z.array(productImportRowSchema),
});

export type ProductImportReport = z.infer<typeof productImportReportSchema>;
