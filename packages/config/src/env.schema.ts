import { z } from 'zod';

const postgresUrlSchema = z
  .string({
    required_error: 'Database URL is required',
  })
  .refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    {
      message: 'Database connection URL must start with postgresql:// or postgres://',
    },
  );

const redisUrlSchema = z
  .string({
    required_error: 'Redis URL is required',
  })
  .refine(
    (url) => url.startsWith('rediss://') || url.startsWith('redis://'),
    {
      message: 'Redis URL must start with rediss:// or redis://',
    },
  );

const dataEncryptionKeySchema = z
  .string({
    required_error: 'DATA_ENCRYPTION_KEY is required',
  })
  .refine(
    (key) => {
      try {
        const buf = Buffer.from(key, 'base64');
        return buf.length === 32;
      } catch {
        return false;
      }
    },
    {
      message: 'DATA_ENCRYPTION_KEY must be a valid base64 string decoding to exactly 32 bytes',
    },
  );

const passportLookupPepperSchema = z
  .string({
    required_error: 'PASSPORT_LOOKUP_PEPPER is required',
  })
  .min(16, {
    message: 'PASSPORT_LOOKUP_PEPPER must be at least 16 characters long',
  });

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema,
  REDIS_URL: redisUrlSchema,
  DATA_ENCRYPTION_KEY: dataEncryptionKeySchema,
  PASSPORT_LOOKUP_PEPPER: passportLookupPepperSchema,
  API_PORT: z.coerce.number().int().positive().default(3001),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  VFS_HEADLESS: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? true : val === 'true' || val === '1')),
  VFS_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  VFS_ACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  VFS_ALLOWED_ORIGINS: z.string().default('https://visa.vfsglobal.com'),
  AUTOMATION_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  WORKER_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
