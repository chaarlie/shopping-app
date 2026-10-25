import { pageQuerySchema } from './pagination.js';
import { z } from 'zod';
export const adminSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.email(),
});
export type Admin = z.infer<typeof adminSchema>;
export const signInSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(256),
});
export type SignInInput = z.infer<typeof signInSchema>;
export const bootstrapAdminSchema = signInSchema.extend({
  name: z.string().trim().min(1).max(200),
  password: z.string().min(12).max(256),
});

export const adminProductsQuerySchema = pageQuerySchema.extend({
  q: z.string().max(100).default(''),
  reorder: z.enum(['true', 'false']).default('false'),
});
