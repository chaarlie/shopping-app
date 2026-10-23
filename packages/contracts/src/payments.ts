import { z } from 'zod';
import { cardSchema } from './cards.js';
import { currencySchema, maxPaymentAmountCents } from './orders.js';

const merchantReferenceSchema = z
  .string()
  .trim()
  .min(1, 'Order reference is required')
  .max(64, 'Order reference must be at most 64 characters');

export const paymentStatusSchema = z.enum([
  'processing',
  'succeeded',
  'failed',
  'refunded',
]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const createPaymentSchema = z.strictObject({
  orderReference: merchantReferenceSchema,
  amountCents: z
    .number()
    .int('Amount must be a whole number of cents')
    .positive('Amount must be greater than 0')
    .max(maxPaymentAmountCents, 'Amount must be at most 999,999.99'),
  currency: currencySchema,
  card: cardSchema,
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const paymentSchema = z.object({
  id: z.uuid(),
  orderReference: z.string(),
  status: paymentStatusSchema,
  amountCents: z.number().int(),
  currency: currencySchema,
  cardBrand: z.string(),
  cardLast4: z.string(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Payment = z.infer<typeof paymentSchema>;

export const paymentListQuerySchema = z.strictObject({
  orderReference: merchantReferenceSchema,
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const paymentListSchema = z.object({
  items: z.array(paymentSchema),
});

export type PaymentList = z.infer<typeof paymentListSchema>;
