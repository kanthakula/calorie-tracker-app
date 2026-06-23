// Web-local type/schema extensions that complement @k21/validation.
//
// `DailyInsight` is part of the API contract for GET /api/meals/summary but is not
// (yet) exported from @k21/validation — it lives in the Node API's insight service.
// We mirror its shape here with a Zod schema so the web app can validate the
// summary response end-to-end.
import { z } from 'zod';
import {
  DailyTotalsSchema,
  DailyGoalSchema,
  IsoDateSchema,
  ProfileSchema,
  TargetsSchema,
  AlertSchema,
  WorkoutSchema,
  DailyEnergySchema,
  AdaptiveTDEESchema,
  WeightTrendPointSchema,
} from '@k21/validation';

/** Where the day's effective targets come from. Kept tolerant for older APIs. */
export const TargetSourceSchema = z.enum(['adaptive', 'estimated', 'manual']);
export type TargetSource = z.infer<typeof TargetSourceSchema>;

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

/**
 * Response shape of GET /api/meals/summary?date=YYYY-MM-DD.
 *
 * `targets` and `alerts` were added alongside the profile feature; `workouts` and
 * `energy` alongside the workouts feature. All are kept tolerant (nullable /
 * defaulted) so older API responses that omit them still parse.
 */
export const MealSummarySchema = z.object({
  totals: DailyTotalsSchema,
  goal: DailyGoalSchema,
  insight: DailyInsightSchema,
  targets: TargetsSchema.nullable().optional().default(null),
  alerts: z.array(AlertSchema).optional().default([]),
  workouts: z.array(WorkoutSchema).optional().default([]),
  energy: DailyEnergySchema.nullable().optional(),
  // Sprint 6: adaptive (measured) TDEE + where the day's targets come from.
  adaptiveTdee: AdaptiveTDEESchema.nullable().optional(),
  targetSource: TargetSourceSchema.optional(),
  // Sprint 7: today's hydration total + target (target may be unset).
  water: z
    .object({ ml: z.number(), targetMl: z.number().nullable() })
    .nullable()
    .optional(),
});
export type MealSummary = z.infer<typeof MealSummarySchema>;

/**
 * Response shape of GET/PUT /api/profile. `@k21/validation` exports the pieces
 * (Profile, Targets) but not this composite, so we assemble it here.
 */
export const ProfileResultSchema = z.object({
  profile: ProfileSchema,
  suggestedTargets: TargetsSchema.nullable(),
  effectiveTargets: TargetsSchema.nullable(),
  // Sprint 6: effectiveTargets already reflects adaptive when available; these
  // expose the measured TDEE + its source so the UI can label/explain it.
  adaptiveTdee: AdaptiveTDEESchema.nullable().optional(),
  targetSource: TargetSourceSchema.optional(),
});
export type ProfileResult = z.infer<typeof ProfileResultSchema>;

/**
 * Response shape of GET /api/weight. `entries` are the raw weigh-ins and `trend`
 * the exponentially-smoothed series; `latestKg` is the most recent weight (or null).
 */
export const WeightEntryLiteSchema = z.object({
  id: z.string(),
  date: IsoDateSchema,
  weightKg: z.number(),
});
export type WeightEntryLite = z.infer<typeof WeightEntryLiteSchema>;

export const WeightHistorySchema = z.object({
  entries: z.array(WeightEntryLiteSchema),
  trend: z.array(WeightTrendPointSchema),
  latestKg: z.number().nullable(),
});
export type WeightHistory = z.infer<typeof WeightHistorySchema>;
