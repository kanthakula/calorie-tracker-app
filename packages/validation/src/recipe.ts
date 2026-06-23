import { z } from 'zod';
import { CaloriesSchema, CuidSchema, GramsSchema } from './common.js';

/**
 * One ingredient line in a recipe — a named macro contribution already scaled
 * to the amount used (the builder multiplies a library item by its quantity, or
 * the user enters macros directly). Recipe totals are the sum of these.
 */
export const RecipeIngredientInputSchema = z.object({
  name: z.string().min(1).max(120),
  calories: CaloriesSchema,
  protein: GramsSchema.default(0),
  carbs: GramsSchema.default(0),
  fat: GramsSchema.default(0),
});
export type RecipeIngredientInput = z.infer<typeof RecipeIngredientInputSchema>;

export const RecipeIngredientSchema = RecipeIngredientInputSchema.extend({
  id: CuidSchema,
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

/**
 * A named, multi-ingredient dish. `calories`/macros are the TOTAL across all
 * ingredients (the whole recipe); per-serving = total / `servings`, computed by
 * consumers when logging.
 */
export const RecipeSchema = z.object({
  id: CuidSchema,
  name: z.string().min(1).max(80),
  servings: z.number().int().min(1).max(50),
  calories: CaloriesSchema,
  protein: GramsSchema.default(0),
  carbs: GramsSchema.default(0),
  fat: GramsSchema.default(0),
  ingredients: z.array(RecipeIngredientSchema),
  createdAt: z.string().datetime().optional(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const CreateRecipeSchema = z.object({
  name: z.string().min(1).max(80),
  servings: z.number().int().min(1).max(50).default(1),
  ingredients: z
    .array(RecipeIngredientInputSchema)
    .min(1, 'Add at least one ingredient.')
    .max(50),
});
export type CreateRecipe = z.infer<typeof CreateRecipeSchema>;
