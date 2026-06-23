import { z } from 'zod';
import { CuidSchema, IsoDateSchema } from './common.js';

export const WorkoutSourceSchema = z.enum(['met', 'manual', 'wearable']);
export type WorkoutSource = z.infer<typeof WorkoutSourceSchema>;

/** Common activities with MET values (Compendium of Physical Activities, approx). */
export const MET_ACTIVITIES = [
  { key: 'walking', name: 'Walking', emoji: '🚶', met: 3.5 },
  { key: 'running', name: 'Running', emoji: '🏃', met: 9.8 },
  { key: 'cycling', name: 'Cycling', emoji: '🚴', met: 7.5 },
  { key: 'swimming', name: 'Swimming', emoji: '🏊', met: 8.0 },
  { key: 'yoga', name: 'Yoga', emoji: '🧘', met: 3.0 },
  { key: 'weightlifting', name: 'Weight training', emoji: '🏋️', met: 6.0 },
  { key: 'hiit', name: 'HIIT', emoji: '🔥', met: 8.0 },
  { key: 'elliptical', name: 'Elliptical', emoji: '🌀', met: 5.0 },
  { key: 'hiking', name: 'Hiking', emoji: '🥾', met: 6.0 },
  { key: 'dancing', name: 'Dancing', emoji: '💃', met: 5.0 },
  { key: 'basketball', name: 'Basketball', emoji: '🏀', met: 8.0 },
  { key: 'soccer', name: 'Soccer', emoji: '⚽', met: 7.0 },
  { key: 'tennis', name: 'Tennis', emoji: '🎾', met: 7.0 },
  { key: 'cricket', name: 'Cricket', emoji: '🏏', met: 5.0 },
  { key: 'jump_rope', name: 'Jump rope', emoji: '🪢', met: 12.0 },
  { key: 'rowing', name: 'Rowing', emoji: '🚣', met: 7.0 },
  { key: 'pilates', name: 'Pilates', emoji: '🤸', met: 3.0 },
  { key: 'stairs', name: 'Stair climbing', emoji: '🪜', met: 9.0 },
  { key: 'boxing', name: 'Boxing', emoji: '🥊', met: 9.0 },
  // Sports & games (Compendium of Physical Activities MET values).
  { key: 'badminton', name: 'Badminton', emoji: '🏸', met: 5.5 },
  { key: 'table_tennis', name: 'Table tennis', emoji: '🏓', met: 4.0 },
  { key: 'volleyball', name: 'Volleyball', emoji: '🏐', met: 4.0 },
  { key: 'golf', name: 'Golf (walking)', emoji: '⛳', met: 4.5 },
  { key: 'squash', name: 'Squash', emoji: '🎾', met: 7.3 },
  { key: 'baseball', name: 'Baseball / softball', emoji: '⚾', met: 5.0 },
  { key: 'skating', name: 'Skating', emoji: '⛸️', met: 7.0 },
  { key: 'skiing', name: 'Skiing / snowboarding', emoji: '🎿', met: 5.3 },
  { key: 'martial_arts', name: 'Martial arts', emoji: '🥋', met: 10.3 },
  { key: 'climbing', name: 'Rock climbing', emoji: '🧗', met: 8.0 },
  { key: 'field_hockey', name: 'Field hockey', emoji: '🏑', met: 8.0 },
  { key: 'kabaddi', name: 'Kabaddi', emoji: '🤼', met: 7.0 },
  // Yoga & mind-body.
  { key: 'power_yoga', name: 'Power yoga', emoji: '🧘', met: 4.0 },
  { key: 'hatha_yoga', name: 'Hatha yoga', emoji: '🧘‍♂️', met: 2.5 },
  { key: 'tai_chi', name: 'Tai chi', emoji: '☯️', met: 3.0 },
  { key: 'stretching', name: 'Stretching', emoji: '🤸‍♀️', met: 2.3 },
  { key: 'custom', name: 'Other', emoji: '🤾', met: 5.0 },
] as const;

export type MetActivity = (typeof MET_ACTIVITIES)[number];

export function metFor(activityKey: string): number {
  return MET_ACTIVITIES.find((a) => a.key === activityKey)?.met ?? 5.0;
}

export function activityEmoji(activityKey: string): string {
  return MET_ACTIVITIES.find((a) => a.key === activityKey)?.emoji ?? '🏃';
}

/** kcal = MET × weight(kg) × hours. */
export function computeBurn(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return Math.max(0, Math.round(met * weightKg * (minutes / 60)));
}

export const WorkoutSchema = z.object({
  id: CuidSchema,
  name: z.string().min(1).max(80),
  activity: z.string().min(1).max(40),
  date: IsoDateSchema,
  durationMin: z.number().int().min(1).max(1440),
  caloriesBurned: z.number().int().min(0).max(20000),
  source: WorkoutSourceSchema.default('met'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Workout = z.infer<typeof WorkoutSchema>;

export const CreateWorkoutSchema = WorkoutSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  source: WorkoutSourceSchema.default('met'),
});
export type CreateWorkout = z.infer<typeof CreateWorkoutSchema>;

export const UpdateWorkoutSchema = CreateWorkoutSchema.partial();
export type UpdateWorkout = z.infer<typeof UpdateWorkoutSchema>;

/** Daily energy balance shown alongside the meal summary. */
export const DailyEnergySchema = z.object({
  /** Calories eaten. */
  intake: z.number().int().min(0),
  /** Active calories from workouts. */
  burned: z.number().int().min(0),
  /** Resting energy (BMR). Null if the profile lacks the stats to compute it. */
  restingBurn: z.number().int().min(0).nullable(),
  /** Energy balance = intake − resting − active. Null when resting is unknown. Negative = deficit. */
  net: z.number().int().nullable(),
});
export type DailyEnergy = z.infer<typeof DailyEnergySchema>;
