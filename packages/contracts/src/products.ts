import { z } from 'zod';
import { pageQuerySchema, pageSchema } from './pagination.js';

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, { error: 'SKU is required', abort: true })
  .regex(
    /^[A-Z0-9][A-Z0-9-]{0,31}$/,
    'SKU must be 1 to 32 letters, digits or hyphens',
  );

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(200, 'Name must be at most 200 characters');

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Description must be at most 2000 characters');

const categorySchema = z
  .string()
  .trim()
  .min(1, 'Category is required')
  .max(100, 'Category must be at most 100 characters');

const priceCentsSchema = z
  .number()
  .int('Price must be a whole number of cents')
  .positive('Price must be greater than 0')
  .max(100_000_000, 'Price must be at most 1,000,000.00');

const stockSchema = z
  .number()
  .int('Stock must be a whole number')
  .min(0, 'Stock cannot be negative')
  .max(1_000_000, 'Stock must be at most 1,000,000');

const weightGramsSchema = z
  .number()
  .int('Weight must be a whole number of grams')
  .min(0, 'Weight cannot be negative')
  .max(1_000_000, 'Weight must be at most 1,000 kg')
  .nullable();

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

export const maxSearchResults = 10_000;

export const productSortSchema = z.enum([
  'relevance',
  'name',
  'price_asc',
  'price_desc',
  'newest',
]);

export type ProductSort = z.infer<typeof productSortSchema>;

export const productSearchQuerySchema = pageQuerySchema
  .extend({
    q: z
      .string()
      .trim()
      .min(1, 'Type something to search for')
      .max(100, 'Search text must be at most 100 characters')
      .optional(),
    category: categorySchema.optional(),
    sort: productSortSchema.optional(),
  })
  .refine(({ page, pageSize }) => page * pageSize <= maxSearchResults, {
    error: `Search shows at most the first ${maxSearchResults} results. Narrow the search to see more.`,
    path: ['page'],
  });

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const categorySummarySchema = z.object({
  name: z.string(),
  productCount: z.number().int(),
});

export type CategorySummary = z.infer<typeof categorySummarySchema>;

export const categoryListSchema = z.object({
  items: z.array(categorySummarySchema),
});

export type CategoryList = z.infer<typeof categoryListSchema>;
