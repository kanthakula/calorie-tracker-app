import { z } from 'zod';
import { ProviderSchema } from './common.js';

/** Admin login request — owner console requires BOTH a username and password. */
export const AdminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type AdminLogin = z.infer<typeof AdminLoginSchema>;

/** Per-provider status as returned to the admin UI — keys are NEVER included. */
export const ProviderStatusSchema = z.object({
  id: ProviderSchema,
  model: z.string(),
  defaultModel: z.string(),
  hasKey: z.boolean(),
  keySource: z.enum(['ui', 'env', 'none']),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

/** Masked config returned by `GET /api/admin/config`. */
export const AdminConfigSchema = z.object({
  activeProvider: ProviderSchema,
  providers: z.array(ProviderStatusSchema),
  kimiBaseURL: z.string(),
});
export type AdminConfig = z.infer<typeof AdminConfigSchema>;

/** Update payload for `POST /api/admin/config`. Send a key as null to clear it. */
export const UpdateAdminConfigSchema = z.object({
  provider: ProviderSchema.optional(),
  models: z.record(ProviderSchema, z.string()).optional(),
  keys: z.record(ProviderSchema, z.string().nullable()).optional(),
  kimiBaseURL: z.string().optional(),
});
export type UpdateAdminConfig = z.infer<typeof UpdateAdminConfigSchema>;
