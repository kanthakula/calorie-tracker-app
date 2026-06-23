import { z } from 'zod';

/** Supported LLM providers for food-image analysis. */
export const ProviderSchema = z.enum(['gemini', 'openai', 'anthropic', 'kimi']);
export type Provider = z.infer<typeof ProviderSchema>;

/** Meal slot a record belongs to. */
export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof MealTypeSchema>;

/** How a meal record was created. */
export const MealSourceSchema = z.enum(['manual', 'library', 'ai', 'recipe']);
export type MealSource = z.infer<typeof MealSourceSchema>;

/** Model's self-reported confidence in an image analysis. */
export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** Calendar day in strict ISO `YYYY-MM-DD` form (the app's primary key for a day). */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Image MIME types the analyzer accepts. */
export const ImageMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
export type ImageMimeType = z.infer<typeof ImageMimeTypeSchema>;

/** A non-negative grams value for a macronutrient (whole grams, capped sanely). */
export const GramsSchema = z.number().int().min(0).max(1000);

/** Kilocalories for a portion. */
export const CaloriesSchema = z.number().int().min(0).max(10000);

/** Healthiness rating, 1 (very unhealthy) – 5 (very healthy). */
export const HealthRatingSchema = z.number().int().min(1).max(5);

export const CuidSchema = z.string().min(1);
