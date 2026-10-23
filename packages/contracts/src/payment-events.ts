import { z } from 'zod';
import { currencySchema } from './orders.js';

const paymentEventDataSchema = z.object({
  paymentId: z.uuid(),
  orderReference: z.string(),
  idempotencyKey: z.string(),
  amountCents: z.number().int(),
  currency: currencySchema,
  cardLast4: z.string(),
});

export const paymentSucceededEventSchema = z.object({
  id: z.uuid(),
  type: z.literal('payment.succeeded'),
  createdAt: z.iso.datetime(),
  data: paymentEventDataSchema,
});

export const paymentFailedEventSchema = z.object({
  id: z.uuid(),
  type: z.literal('payment.failed'),
  createdAt: z.iso.datetime(),
  data: paymentEventDataSchema.extend({
    failureCode: z.string(),
    failureMessage: z.string(),
  }),
});

export const paymentEventSchema = z.discriminatedUnion('type', [
  paymentSucceededEventSchema,
  paymentFailedEventSchema,
]);

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export type PaymentSucceededEvent = z.infer<typeof paymentSucceededEventSchema>;

export type PaymentFailedEvent = z.infer<typeof paymentFailedEventSchema>;
