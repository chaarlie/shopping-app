import { z } from 'zod';
import { productCsvColumns, productImportRowSchema } from './product-import.js';
import { pageQuerySchema, pageSchema } from './pagination.js';
export const importValuesSchema = z.record(
  z.enum(productCsvColumns),
  z.string().max(10000),
);
export const editImportRowSchema = z
  .strictObject({
    version: z.number().int().positive(),
    values: importValuesSchema.optional(),
    excluded: z.boolean().optional(),
  })
  .refine(
    (v) => v.values !== undefined || v.excluded !== undefined,
    'Supply row values or an exclusion decision',
  );
export const importActionSchema = z.strictObject({
  version: z.number().int().positive(),
  updateStock: z.boolean().optional(),
});
export const importPreviewQuerySchema = pageQuerySchema.extend({
  status: z
    .enum([
      'all',
      'create',
      'update',
      'unchanged',
      'skip',
      'duplicate',
      'error',
      'excluded',
    ])
    .default('all'),
  sku: z.string().max(32).optional(),
});
export const stagedRowSchema = productImportRowSchema.extend({
  status: z.enum([
    'create',
    'update',
    'unchanged',
    'skip',
    'duplicate',
    'error',
    'excluded',
  ]),
  changes: z.array(
    z.object({ field: z.string(), before: z.string(), after: z.string() }),
  ),
  editedBy: z.string().nullable(),
  editedAt: z.string().nullable(),
  excluded: z.boolean(),
});
export type StagedRow = z.infer<typeof stagedRowSchema>;
export const importSummarySchema = z.object({
  id: z.number().int(),
  filename: z.string(),
  fileError: z.string().nullable(),
  size: z.number().int(),
  sha256: z.string(),
  uploadedBy: z.string(),
  uploadedAt: z.string(),
  appliedBy: z.string().nullable(),
  appliedAt: z.string().nullable(),
  version: z.number().int(),
  updateStock: z.boolean(),
  counts: z.record(z.string(), z.number().int()),
  totalRows: z.number().int(),
  blankRows: z.number().int(),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;
export const importPreviewSchema = z.object({
  summary: importSummarySchema,
  rows: z.array(stagedRowSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export const importHistorySchema = pageSchema(importSummarySchema);
