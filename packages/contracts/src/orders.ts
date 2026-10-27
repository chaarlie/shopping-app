import { z } from 'zod';
import { pageQuerySchema, pageSchema } from './pagination.js';
import { cardSchema } from './cards.js';

export const maxOrderQuantity = 1_000_000;
export const checkoutSettingsSchema = z.object({
  maxQuantityPerProduct: z.number().int().min(1).max(maxOrderQuantity),
});

export const currencySchema = z.literal('USD');

export type Currency = z.infer<typeof currencySchema>;

export const maxPaymentAmountCents = 99_999_999;

export const idempotencyKeySchema = z
  .string({ error: 'Send an Idempotency-Key header' })
  .trim()
  .regex(
    /^[A-Za-z0-9_.:-]{8,200}$/,
    'Idempotency-Key must be 8 to 200 letters, digits or the characters _ . : -',
  );

export const orderReferenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^SR-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    'Order references look like SR-7K3Q-X9PM',
  );

export const orderStatusSchema = z.enum([
  'pending_payment',
  'paid',
  'cancelled',
  'refund_pending',
  'refunded',
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

const finalOrderStatuses: ReadonlySet<OrderStatus> = new Set([
  'paid',
  'cancelled',
  'refunded',
]);

export function isFinalOrderStatus(status: OrderStatus): boolean {
  return finalOrderStatuses.has(status);
}

export const paymentAttemptStatusSchema = z.enum([
  'requested',
  'processing',
  'succeeded',
  'declined',
]);

export type PaymentAttemptStatus = z.infer<typeof paymentAttemptStatusSchema>;

const orderItemInputSchema = z.strictObject({
  productId: z.number().int().positive(),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(maxOrderQuantity, 'Quantity exceeds the supported maximum'),
});

export const placeOrderSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email must be at most 254 characters')
    .pipe(z.email('Enter a valid email address')),
  items: z
    .array(orderItemInputSchema)
    .min(1, 'Add at least one product')
    .max(50, 'An order can have at most 50 products')
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      {
        error:
          'Each product can appear only once. Change its quantity instead.',
      },
    ),
  card: cardSchema,
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const retryPaymentSchema = z.strictObject({
  card: cardSchema,
});

export type RetryPaymentInput = z.infer<typeof retryPaymentSchema>;

export const orderLineSchema = z.object({
  productId: z.number().int().nullable(),
  sku: z.string(),
  name: z.string(),
  unitPriceCents: z.number().int(),
  quantity: z.number().int(),
  lineTotalCents: z.number().int(),
});

export type OrderLine = z.infer<typeof orderLineSchema>;

export const orderPaymentSchema = z.object({
  status: paymentAttemptStatusSchema,
  cardLast4: z.string().nullable(),
  declineCode: z.string().nullable(),
  declineMessage: z.string().nullable(),
});

export type OrderPayment = z.infer<typeof orderPaymentSchema>;

export const orderSchema = z.object({
  reference: z.string(),
  status: orderStatusSchema,
  name: z.string(),
  email: z.string(),
  items: z.array(orderLineSchema),
  totalCents: z.number().int(),
  currency: currencySchema,
  dueAt: z.iso.datetime(),
  payment: orderPaymentSchema.nullable(),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Order = z.infer<typeof orderSchema>;

export const adminOrdersQuerySchema = pageQuerySchema.extend({
  status: orderStatusSchema.optional(),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
export const adminOrderSchema = orderSchema.pick({
  reference: true,
  status: true,
  name: true,
  email: true,
  items: true,
  totalCents: true,
  currency: true,
  createdAt: true,
});
export const adminOrdersSchema = pageSchema(adminOrderSchema);
export type AdminOrders = z.infer<typeof adminOrdersSchema>;
