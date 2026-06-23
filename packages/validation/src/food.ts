import { z } from 'zod';
import { CaloriesSchema, CuidSchema, GramsSchema } from './common.js';

/** The food-library categories shown in the picker. */
export const FOOD_CATEGORIES = [
  'Fruits',
  'Vegetables',
  'Grains & Bread',
  'Proteins',
  'Dairy',
  'Indian',
  'Snacks',
  'Fast Food',
  'Beverages',
  'Sweets',
  'Nuts & Seeds',
] as const;

export const FoodCategorySchema = z.enum(FOOD_CATEGORIES);
export type FoodCategory = z.infer<typeof FoodCategorySchema>;

/** A predefined library food item (per stated serving). */
export const FoodItemSchema = z.object({
  id: CuidSchema,
  name: z.string().min(1).max(120),
  category: FoodCategorySchema,
  serving: z.string().min(1).max(60),
  calories: CaloriesSchema,
  protein: GramsSchema,
  carbs: GramsSchema,
  fat: GramsSchema,
});
export type FoodItem = z.infer<typeof FoodItemSchema>;

/** Seed/import shape for a food item (no id). */
export const FoodItemSeedSchema = FoodItemSchema.omit({ id: true });
export type FoodItemSeed = z.infer<typeof FoodItemSeedSchema>;
