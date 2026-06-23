import { z } from 'zod';

export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #RRGGBB');

/** Feature flags — toggle features without a deploy. */
export const FeatureFlagsSchema = z.object({
  aiSnap: z.boolean(),
  foodLibrary: z.boolean(),
  barcode: z.boolean(),
  workouts: z.boolean(),
  water: z.boolean(),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/** Public, non-secret app settings served to web/mobile clients. */
export const AppSettingsSchema = z.object({
  appName: z.string().min(1).max(60),
  tagline: z.string().max(120),
  logoEmoji: z.string().min(1).max(8),
  defaultTheme: ThemeSchema,
  accentColor: HexColor,
  accentColor2: HexColor,
  features: FeatureFlagsSchema,
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

/** Admin update payload — every field optional; features may be partial. */
export const UpdateAppSettingsSchema = z.object({
  appName: z.string().min(1).max(60).optional(),
  tagline: z.string().max(120).optional(),
  logoEmoji: z.string().min(1).max(8).optional(),
  defaultTheme: ThemeSchema.optional(),
  accentColor: HexColor.optional(),
  accentColor2: HexColor.optional(),
  features: FeatureFlagsSchema.partial().optional(),
});
export type UpdateAppSettings = z.infer<typeof UpdateAppSettingsSchema>;
