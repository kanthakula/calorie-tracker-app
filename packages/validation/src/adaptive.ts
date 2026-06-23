import { z } from 'zod';
import { CuidSchema, IsoDateSchema } from './common.js';

/** ~7700 kcal per kg of body mass — the energy-balance constant. */
const KCAL_PER_KG = 7700;

export const WeightEntrySchema = z.object({
  id: CuidSchema,
  date: IsoDateSchema,
  weightKg: z.number().min(20).max(400),
  createdAt: z.string().datetime().optional(),
});
export type WeightEntry = z.infer<typeof WeightEntrySchema>;

export const LogWeightSchema = z.object({
  date: IsoDateSchema,
  weightKg: z.number().min(20).max(400),
});
export type LogWeight = z.infer<typeof LogWeightSchema>;

export const WeightTrendPointSchema = z.object({
  date: IsoDateSchema,
  weightKg: z.number(),
  trendKg: z.number(),
});
export type WeightTrendPoint = z.infer<typeof WeightTrendPointSchema>;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Exponentially-smoothed weight trend (reduces day-to-day noise — water, etc.).
 * Returns one point per entry, sorted by date, with the smoothed `trendKg`.
 */
export function computeTrend(
  entries: { date: string; weightKg: number }[],
  alpha = 0.25,
): WeightTrendPoint[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let trend: number | null = null;
  return sorted.map((e) => {
    trend = trend == null ? e.weightKg : trend + alpha * (e.weightKg - trend);
    return {
      date: e.date,
      weightKg: Math.round(e.weightKg * 100) / 100,
      trendKg: Math.round(trend * 100) / 100,
    };
  });
}

export const AdaptiveTDEESchema = z.object({
  tdee: z.number().int(),
  confidence: z.enum(['low', 'medium', 'high']),
  basedOnDays: z.number().int(),
  weightChangeKgPerWeek: z.number(),
});
export type AdaptiveTDEE = z.infer<typeof AdaptiveTDEESchema>;

/**
 * Estimate true daily expenditure from logged intake and the weight-trend slope
 * (MacroFactor-style): TDEE ≈ avgIntake − (Δtrend_kg × 7700) / spanDays.
 * Returns null until there's enough data to be meaningful.
 */
export function computeAdaptiveTDEE(input: {
  days: { date: string; intake: number }[];
  weights: { date: string; weightKg: number }[];
}): AdaptiveTDEE | null {
  const intakeDays = input.days.filter((d) => d.intake > 0);
  const trend = computeTrend(input.weights);
  if (intakeDays.length < 10 || trend.length < 3) return null;

  const first = trend[0]!;
  const last = trend[trend.length - 1]!;
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < 7) return null;

  const avgIntake = intakeDays.reduce((s, d) => s + d.intake, 0) / intakeDays.length;
  const weightChangeKg = last.trendKg - first.trendKg;
  const tdee = Math.round(avgIntake - (weightChangeKg * KCAL_PER_KG) / spanDays);
  // Sanity guard against absurd estimates from sparse/bad data.
  if (!(tdee > 800) || tdee > 8000) return null;

  const confidence: AdaptiveTDEE['confidence'] =
    intakeDays.length >= 21 && trend.length >= 6
      ? 'high'
      : intakeDays.length >= 14
        ? 'medium'
        : 'low';

  return {
    tdee,
    confidence,
    basedOnDays: intakeDays.length,
    weightChangeKgPerWeek: Math.round((weightChangeKg / spanDays) * 7 * 100) / 100,
  };
}

/** Current logging streak: consecutive days (ending today) that have a meal. */
export function computeStreak(loggedDates: string[], today: string): number {
  const set = new Set(loggedDates);
  let streak = 0;
  let cursor = today;
  // Walk backwards day by day while each day has a log.
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function addDays(iso: string, delta: number): string {
  const ms = Date.parse(iso) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export const WeeklyCheckinSchema = z.object({
  weekStart: IsoDateSchema,
  weekEnd: IsoDateSchema,
  avgIntake: z.number().int(),
  avgBurned: z.number().int(),
  daysLogged: z.number().int(),
  avgNet: z.number().int().nullable(),
  weightTrendChangeKg: z.number().nullable(),
  adaptiveTdee: AdaptiveTDEESchema.nullable(),
  message: z.string(),
});
export type WeeklyCheckin = z.infer<typeof WeeklyCheckinSchema>;

export const StreakSchema = z.object({
  current: z.number().int(),
  loggedToday: z.boolean(),
});
export type Streak = z.infer<typeof StreakSchema>;
