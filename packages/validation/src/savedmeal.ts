import { z } from 'zod';
import { CaloriesSchema, CuidSchema, GramsSchema } from './common.js';

/** A reusable saved meal / recipe (a named macro bundle). */
export const SavedMealSchema = z.object({
  id: CuidSchema,
  name: z.string().min(1).max(80),
  calories: CaloriesSchema,
  protein: GramsSchema.default(0),
  carbs: GramsSchema.default(0),
  fat: GramsSchema.default(0),
  health: z.number().int().min(0).max(5).default(0),
  createdAt: z.string().datetime().optional(),
});
export type SavedMeal = z.infer<typeof SavedMealSchema>;

export const CreateSavedMealSchema = SavedMealSchema.omit({ id: true, createdAt: true }).extend({
  protein: GramsSchema.default(0),
  carbs: GramsSchema.default(0),
  fat: GramsSchema.default(0),
  health: z.number().int().min(0).max(5).default(0),
});
export type CreateSavedMeal = z.infer<typeof CreateSavedMealSchema>;
