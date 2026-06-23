import { z } from 'zod';

export const SexSchema = z.enum(['male', 'female', 'other']);
export type Sex = z.infer<typeof SexSchema>;

export const ActivityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export type ActivityLevel = z.infer<typeof ActivityLevelSchema>;

export const WeightGoalSchema = z.enum(['lose', 'maintain', 'gain']);
export type WeightGoal = z.infer<typeof WeightGoalSchema>;

export const DietPatternSchema = z.enum([
  'balanced',
  'high_protein',
  'low_carb',
  'keto',
  'mediterranean',
]);
export type DietPattern = z.infer<typeof DietPatternSchema>;

/** Human labels for diet patterns (for pickers). */
export const DIET_PATTERN_LABELS: Record<DietPattern, string> = {
  balanced: 'Balanced',
  high_protein: 'High protein',
  low_carb: 'Low carb',
  keto: 'Keto',
  mediterranean: 'Mediterranean',
};

/** Daily nutrition targets (kcal / grams / ml). */
export const TargetsSchema = z.object({
  calorieTarget: z.number().int().min(0).max(20000),
  proteinTarget: z.number().int().min(0).max(1000),
  carbTarget: z.number().int().min(0).max(2000),
  fatTarget: z.number().int().min(0).max(1000),
  waterTargetMl: z.number().int().min(0).max(20000),
});
export type Targets = z.infer<typeof TargetsSchema>;

/** Personal stats + (optional) target overrides. All nullable so a profile can be partial. */
export const ProfileSchema = z.object({
  displayName: z.string().max(80).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  sex: SexSchema.nullable().optional(),
  heightCm: z.number().int().min(50).max(260).nullable().optional(),
  currentWeightKg: z.number().min(20).max(400).nullable().optional(),
  targetWeightKg: z.number().min(20).max(400).nullable().optional(),
  activityLevel: ActivityLevelSchema.default('moderate'),
  goal: WeightGoalSchema.default('maintain'),
  dietPattern: DietPatternSchema.default('balanced'),
  calorieTarget: z.number().int().min(0).max(20000).nullable().optional(),
  proteinTarget: z.number().int().min(0).max(1000).nullable().optional(),
  carbTarget: z.number().int().min(0).max(2000).nullable().optional(),
  fatTarget: z.number().int().min(0).max(1000).nullable().optional(),
  waterTargetMl: z.number().int().min(0).max(20000).nullable().optional(),
  autoTargets: z.boolean().default(true),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** PUT /api/profile body — every field optional, NO defaults (so omitting a
 * field never clobbers the stored value with a default on update). */
export const UpdateProfileSchema = z.object({
  displayName: z.string().max(80).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  sex: SexSchema.nullable().optional(),
  heightCm: z.number().int().min(50).max(260).nullable().optional(),
  currentWeightKg: z.number().min(20).max(400).nullable().optional(),
  targetWeightKg: z.number().min(20).max(400).nullable().optional(),
  activityLevel: ActivityLevelSchema.optional(),
  goal: WeightGoalSchema.optional(),
  dietPattern: DietPatternSchema.optional(),
  calorieTarget: z.number().int().min(0).max(20000).nullable().optional(),
  proteinTarget: z.number().int().min(0).max(1000).nullable().optional(),
  carbTarget: z.number().int().min(0).max(2000).nullable().optional(),
  fatTarget: z.number().int().min(0).max(1000).nullable().optional(),
  waterTargetMl: z.number().int().min(0).max(20000).nullable().optional(),
  autoTargets: z.boolean().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

/** A daily target check shown in the summary. */
export const AlertSchema = z.object({
  level: z.enum(['ok', 'under', 'over', 'info']),
  metric: z.enum(['calories', 'protein', 'carbs', 'fat', 'water']),
  message: z.string(),
});
export type Alert = z.infer<typeof AlertSchema>;

// ---------- Target math (pure; shared by API + clients) ----------

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

type StatsInput = Pick<
  Profile,
  'age' | 'sex' | 'heightCm' | 'currentWeightKg' | 'activityLevel' | 'goal' | 'dietPattern'
>;

/** Macro shaping per diet pattern. */
const DIET_MACROS: Record<
  DietPattern,
  { proteinPerKg: number; fatPct?: number; carbCapPct?: number; carbGrams?: number }
> = {
  balanced: { proteinPerKg: 1.6, fatPct: 0.27 },
  high_protein: { proteinPerKg: 2.0, fatPct: 0.25 },
  low_carb: { proteinPerKg: 1.8, carbCapPct: 0.2 },
  keto: { proteinPerKg: 1.6, carbGrams: 30 },
  mediterranean: { proteinPerKg: 1.6, fatPct: 0.35 },
};

/** Basal metabolic rate (Mifflin–St Jeor), kcal/day. Null without enough data. */
export function computeBMR(
  p: Pick<Profile, 'age' | 'sex' | 'heightCm' | 'currentWeightKg'>,
): number | null {
  const { age, sex, heightCm, currentWeightKg } = p;
  if (!age || !heightCm || !currentWeightKg) return null;
  const base = 10 * currentWeightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;
  return Math.round(bmr);
}

/**
 * Suggested daily targets from stats, via Mifflin–St Jeor BMR → TDEE.
 * Returns null when there isn't enough data (need age, height, current weight).
 */
export function computeTargets(p: StatsInput): Targets | null {
  const { age, sex, heightCm, currentWeightKg } = p;
  if (!age || !heightCm || !currentWeightKg) return null;

  const kg = currentWeightKg;
  const base = 10 * kg + 6.25 * heightCm - 5 * age;
  // Sex offset: +5 (male), −161 (female), −78 (average) when unspecified/other.
  const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;

  const factor = ACTIVITY_FACTOR[p.activityLevel ?? 'moderate'] ?? 1.55;
  // Maintenance TDEE; targetsFromTDEE applies the goal adjustment + macro split.
  const tdee = bmr * factor;
  return targetsFromTDEE(tdee, p.goal ?? 'maintain', kg, p.dietPattern ?? 'balanced');
}

/**
 * Build daily targets from a known total expenditure (TDEE) — used by the
 * adaptive engine, which measures TDEE from data instead of estimating it.
 * Applies the goal adjustment and the diet-pattern macro split.
 */
export function targetsFromTDEE(
  tdee: number,
  goal: WeightGoal,
  weightKg: number,
  dietPattern: DietPattern = 'balanced',
): Targets {
  let cal = tdee;
  if (goal === 'lose') cal -= 500;
  else if (goal === 'gain') cal += 300;
  const calorieTarget = Math.max(1200, Math.round(cal / 10) * 10);

  const m = DIET_MACROS[dietPattern] ?? DIET_MACROS.balanced;
  const proteinTarget = Math.round(m.proteinPerKg * weightKg);
  const proteinKcal = proteinTarget * 4;

  let fatTarget: number;
  let carbTarget: number;
  if (m.carbGrams != null) {
    // Keto: fix carbs low, remainder to fat.
    carbTarget = m.carbGrams;
    fatTarget = Math.max(0, Math.round((calorieTarget - proteinKcal - carbTarget * 4) / 9));
  } else if (m.carbCapPct != null) {
    // Low-carb: cap carbs, remainder to fat.
    carbTarget = Math.round((calorieTarget * m.carbCapPct) / 4);
    fatTarget = Math.max(0, Math.round((calorieTarget - proteinKcal - carbTarget * 4) / 9));
  } else {
    // Set fat by % of calories, remainder to carbs.
    fatTarget = Math.round((calorieTarget * (m.fatPct ?? 0.27)) / 9);
    carbTarget = Math.max(0, Math.round((calorieTarget - proteinKcal - fatTarget * 9) / 4));
  }

  const waterTargetMl = Math.round((35 * weightKg) / 50) * 50; // ~35 ml/kg, rounded to 50
  return { calorieTarget, proteinTarget, carbTarget, fatTarget, waterTargetMl };
}

/**
 * Effective targets to track against: a stored override wins per-field, else the
 * computed suggestion, else a sensible floor. Null only when nothing is known.
 */
export function resolveTargets(p: Profile): Targets | null {
  const computed = computeTargets(p);
  // When autoTargets is on, targets follow the computed suggestion (may be null
  // until the profile has enough data). Otherwise, stored overrides win per field.
  if (p.autoTargets) return computed;
  if (!computed && p.calorieTarget == null) return null;
  return {
    calorieTarget: p.calorieTarget ?? computed?.calorieTarget ?? 2000,
    proteinTarget: p.proteinTarget ?? computed?.proteinTarget ?? 0,
    carbTarget: p.carbTarget ?? computed?.carbTarget ?? 0,
    fatTarget: p.fatTarget ?? computed?.fatTarget ?? 0,
    waterTargetMl: p.waterTargetMl ?? computed?.waterTargetMl ?? 0,
  };
}
