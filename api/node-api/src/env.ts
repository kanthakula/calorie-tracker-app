// Centralized, validated environment access. Loads the repo-root `.env` so all
// services share one source of secrets. Never logs or exposes secret values.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// api/node-api/src -> repo root is three levels up.
const repoRoot = path.resolve(__dirname, '../../..');

// Load root .env first, then a local override if present (local wins).
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NODE_API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1).default('dev-insecure-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  // Shared secret sent to the AI service for internal/admin endpoints.
  AI_INTERNAL_TOKEN: z.string().default('dev-internal-token'),
  ADMIN_USERNAME: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
  // Comma-separated list of allowed web/mobile origins for CORS.
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Print only the field names that failed, never the values.
  const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  console.error(`Invalid environment configuration. Check: ${fields}`);
  throw new Error('Environment validation failed.');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
