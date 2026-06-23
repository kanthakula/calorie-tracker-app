import { z } from 'zod';
import {
  CaloriesSchema,
  CuidSchema,
  GramsSchema,
  HealthRatingSchema,
  IsoDateSchema,
  MealSourceSchema,
  MealTypeSchema,
} from './common.js';

/** A logged meal as stored and returned by the API. */
export const MealSchema = z.object({
  id: CuidSchema,
  name: z.string().min(1).max(120),
  calories: CaloriesSchema,
  type: MealTypeSchema,
  date: IsoDateSchema,
  protein: GramsSchema.default(0),
  carbs: GramsSchema.default(0),
  fat: GramsSchema.default(0),
  /** 1–5 healthiness (from AI or category mapping); 0 = unrated. */
  health: z.number().int().min(0).max(5).default(0),
  source: MealSourceSchema.default('manual'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Meal = z.infer<typeof MealSchema>;

/** Payload to create a meal (server assigns id/timestamps). */
export const CreateMealSchema = MealSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  protein: GramsSchema.default(0),
  carbs: GramsSchema.default(0),
  fat: GramsSchema.default(0),
  health: z.number().int().min(0).max(5).default(0),
  source: MealSourceSchema.default('manual'),
});
export type CreateMeal = z.infer<typeof CreateMealSchema>;

/** Partial update for a meal. */
export const UpdateMealSchema = CreateMealSchema.partial();
export type UpdateMeal = z.infer<typeof UpdateMealSchema>;

/** Query for listing meals (optionally by date or inclusive range). */
export const MealQuerySchema = z
  .object({
    date: IsoDateSchema.optional(),
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
  })
  .refine((q) => !(q.date && (q.from || q.to)), {
    message: 'Use either `date` or a `from`/`to` range, not both.',
  });
export type MealQuery = z.infer<typeof MealQuerySchema>;

/** Daily nutrition totals derived from meals (returned by the summary endpoint). */
export const DailyTotalsSchema = z.object({
  date: IsoDateSchema,
  calories: z.number().int().min(0),
  protein: z.number().int().min(0),
  carbs: z.number().int().min(0),
  fat: z.number().int().min(0),
  mealCount: z.number().int().min(0),
  /** Average healthiness across rated meals (0 if none rated). */
  avgHealth: z.number().min(0).max(5),
});
export type DailyTotals = z.infer<typeof DailyTotalsSchema>;
