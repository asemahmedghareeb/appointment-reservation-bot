import { config as loadDotenv } from 'dotenv';
import { envSchema, type Env } from './env.schema.js';

// Attempt to load .env from process.cwd() or root
loadDotenv();

export function validateEnv(rawEnv: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    const formattedMessage = errorDetails
      .map((d) => `  - ${d.field}: ${d.message}`)
      .join('\n');

    throw new Error(
      `[VisaFlow Config] Environment validation failed:\n${formattedMessage}\nCheck your .env file against .env.example.`,
    );
  }

  return Object.freeze(result.data);
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}
