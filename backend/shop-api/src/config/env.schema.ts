import { isWebhookSecret } from '@shop/webhook-signature';
import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PAYMENTS_API_URL: z.url({ protocol: /^https?$/ }),
  PAYMENTS_API_KEY: z.string().min(32),
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .refine(
      isWebhookSecret,
      'Use whsec_ followed by canonical base64 encoding of 24 to 64 bytes',
    ),
  ORDER_ACCESS_SECRET: z.string().min(32),
  ORDER_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  BACKGROUND_JOBS: z.enum(['on', 'off']).default('on'),
});

export type Env = z.infer<typeof envSchema>;

const migrationEnvSchema = envSchema.pick({ DATABASE_URL: true });

export function validateEnv(config: Record<string, unknown>): Env {
  return parse(envSchema, config);
}

export function validateMigrationEnv(
  config: Record<string, unknown>,
): z.infer<typeof migrationEnvSchema> {
  return parse(migrationEnvSchema, config);
}

function parse<T extends z.ZodType>(
  schema: T,
  config: Record<string, unknown>,
): z.output<T> {
  const result = schema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
