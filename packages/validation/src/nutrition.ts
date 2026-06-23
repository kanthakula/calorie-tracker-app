import { z } from 'zod';
import {
  CaloriesSchema,
  ConfidenceSchema,
  GramsSchema,
  HealthRatingSchema,
  ImageMimeTypeSchema,
  ProviderSchema,
} from './common.js';

/**
 * The structured nutrition result returned by any provider's image analysis.
 * This is the canonical contract — the Python AI service, the Node API, and
 * every client agree on exactly this shape.
 */
export const FoodAnalysisSchema = z.object({
  food_name: z.string().min(1).max(120),
  estimated_calories: CaloriesSchema,
  protein_g: GramsSchema,
  carbs_g: GramsSchema,
  fat_g: GramsSchema,
  healthiness_rating: HealthRatingSchema,
  portion_recommendation: z.string().max(400),
  confidence: ConfidenceSchema,
  notes: z.string().max(600),
});
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

/** Request body for `POST /api/analyze-food`. */
export const AnalyzeFoodRequestSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  mimeType: ImageMimeTypeSchema,
});
export type AnalyzeFoodRequest = z.infer<typeof AnalyzeFoodRequestSchema>;

/** Response body for `POST /api/analyze-food` — the analysis plus provenance. */
export const AnalyzeFoodResponseSchema = FoodAnalysisSchema.extend({
  provider: ProviderSchema,
  model: z.string(),
});
export type AnalyzeFoodResponse = z.infer<typeof AnalyzeFoodResponseSchema>;
