// App-local type/schema extensions that complement @k21/validation.
//
// `DailyInsight` is part of the API contract for GET /api/meals/summary but is
// not exported from @k21/validation (it lives in the Node API's insight
// service). We mirror its shape with a Zod schema so the mobile app can
// validate the summary response end-to-end.
import { z } from 'zod';
import { DailyTotalsSchema, DailyGoalSchema, IsoDateSchema } from '@k21/validation';

export const DailyInsightSchema = z.object({
  date: IsoDateSchema,
  consumed: z.number(),
  goal: z.number(),
  remaining: z.number(),
  avgHealth: z.number(),
  headline: z.string(),
  suggestion: z.string(),
});
export type DailyInsight = z.infer<typeof DailyInsightSchema>;

/** Response shape of GET /api/meals/summary?date=YYYY-MM-DD. */
export const MealSummarySchema = z.object({
  totals: DailyTotalsSchema,
  goal: DailyGoalSchema,
  insight: DailyInsightSchema,
});
export type MealSummary = z.infer<typeof MealSummarySchema>;
