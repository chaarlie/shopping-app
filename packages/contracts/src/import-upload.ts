import { z } from "zod";

export const MAX_IMPORT_BYTES = 5_000_000_000;
export const IMPORT_PART_BYTES = 16 * 1024 * 1024;
export const MAX_IMPORT_PARTS = Math.ceil(MAX_IMPORT_BYTES / IMPORT_PART_BYTES);
export const startImportUploadSchema = z.strictObject({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_IMPORT_BYTES),
});
export const importUploadStateSchema = z.enum([
  "uploading",
  "queued",
  "processing",
  "ready",
  "failed",
  "cancelled",
]);
export const importUploadSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  size: z.number().int().positive(),
  partSize: z.number().int().positive(),
  partCount: z.number().int().positive(),
  state: importUploadStateSchema,
  expiresAt: z.string(),
  importId: z.number().int().positive().nullable(),
  error: z.string().nullable(),
});
export const uploadPartNumberSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_IMPORT_PARTS);
export const importPartUrlSchema = z.object({
  url: z.url(),
  expiresIn: z.number().int().positive(),
});
export type ImportUpload = z.infer<typeof importUploadSchema>;
export type StartImportUpload = z.infer<typeof startImportUploadSchema>;
