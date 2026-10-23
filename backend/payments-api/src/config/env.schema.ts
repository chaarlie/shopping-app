import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PAYMENTS_API_KEY: z.string().min(32),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PAYMENT_SETTLE_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .default(2000),
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
