import { z } from 'zod';
import { pageQuerySchema, pageSchema } from './pagination.js';

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9-]{0,31}$/,
    'SKU must be 1 to 32 letters, digits or hyphens',
  );

const nameSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().trim().max(2000);
const categorySchema = z.string().trim().min(1).max(100);
const priceCentsSchema = z.number().int().positive().max(100_000_000);
const stockSchema = z.number().int().min(0).max(1_000_000);
const weightGramsSchema = z.number().int().min(0).max(1_000_000).nullable();

export const productSchema = z.object({
  id: z.number().int(),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  priceCents: z.number().int(),
  stock: z.number().int(),
  weightGrams: z.number().int().nullable(),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.strictObject({
  sku: skuSchema,
  name: nameSchema,
  description: descriptionSchema.default(''),
  category: categorySchema,
  priceCents: priceCentsSchema,
  stock: stockSchema,
  weightGrams: weightGramsSchema.default(null),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.strictObject({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  category: categorySchema.optional(),
  priceCents: priceCentsSchema.optional(),
  stock: stockSchema.optional(),
  weightGrams: weightGramsSchema.optional(),
  version: z.number().int().positive(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productListQuerySchema = pageQuerySchema.extend({
  category: categorySchema.optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productPageSchema = pageSchema(productSchema);

export type ProductPage = z.infer<typeof productPageSchema>;
