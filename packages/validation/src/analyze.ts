import { z } from 'zod';
import {
  CaloriesSchema,
  ConfidenceSchema,
  GramsSchema,
  HealthRatingSchema,
  ImageMimeTypeSchema,
  ProviderSchema,
} from './common.js';

/** Where an item's nutrition numbers came from (drives the trust/source badge). */
export const NutrientSourceSchema = z.enum([
  'vision', // the vision model's own estimate
  'usda', // grounded in USDA FoodData Central
  'openfoodfacts', // grounded in Open Food Facts
  'barcode', // exact packaged product via barcode
  'manual', // user-entered/edited
]);
export type NutrientSource = z.infer<typeof NutrientSourceSchema>;

/** One identified food item with an estimated portion and grounded nutrition. */
export const FoodItemAnalysisSchema = z.object({
  name: z.string().min(1).max(120),
  /** Estimated portion in grams (or ml treated as g) for the visible serving. */
  quantityG: z.number().min(0).max(5000),
  calories: CaloriesSchema,
  protein_g: GramsSchema,
  carbs_g: GramsSchema,
  fat_g: GramsSchema,
  confidence: ConfidenceSchema,
  source: NutrientSourceSchema,
  /** Reference id when grounded (FDC id or barcode). */
  ref: z.string().max(64).nullable().optional(),
});
export type FoodItemAnalysis = z.infer<typeof FoodItemAnalysisSchema>;

export const NutritionTotalSchema = z.object({
  calories: CaloriesSchema,
  protein_g: GramsSchema,
  carbs_g: GramsSchema,
  fat_g: GramsSchema,
});
export type NutritionTotal = z.infer<typeof NutritionTotalSchema>;

/** Multi-item meal analysis — the v2 response of POST /api/analyze-food. */
export const MealAnalysisSchema = z.object({
  items: z.array(FoodItemAnalysisSchema),
  total: NutritionTotalSchema,
  healthiness_rating: HealthRatingSchema,
  confidence: ConfidenceSchema,
  notes: z.string().max(600),
  provider: ProviderSchema,
  model: z.string(),
});
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

/** Request body for POST /api/analyze-food (unchanged). */
export const AnalyzeImageRequestSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  mimeType: ImageMimeTypeSchema,
});
export type AnalyzeImageRequest = z.infer<typeof AnalyzeImageRequestSchema>;

/** Request body for POST /api/analyze-text (voice/typed meal description). */
export const AnalyzeTextRequestSchema = z.object({
  text: z.string().min(1).max(500),
});
export type AnalyzeTextRequest = z.infer<typeof AnalyzeTextRequestSchema>;

/** A product resolved from a barcode (Open Food Facts). */
export const BarcodeProductSchema = z.object({
  found: z.boolean(),
  barcode: z.string(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  serving: z.string().nullable().optional(),
  /** Nutrition for the stated serving (or per 100g if no serving). */
  item: FoodItemAnalysisSchema.nullable(),
});
export type BarcodeProduct = z.infer<typeof BarcodeProductSchema>;
