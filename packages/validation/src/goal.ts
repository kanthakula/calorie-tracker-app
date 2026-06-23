import { z } from 'zod';
import { IsoDateSchema } from './common.js';

/** A user's calorie goal. A goal with a null date is the default/standing goal. */
export const DailyGoalSchema = z.object({
  date: IsoDateSchema.nullable(),
  calorieGoal: z.number().int().min(0).max(20000),
});
export type DailyGoal = z.infer<typeof DailyGoalSchema>;

export const SetGoalSchema = z.object({
  date: IsoDateSchema.nullable().default(null),
  calorieGoal: z.number().int().min(0).max(20000),
});
export type SetGoal = z.infer<typeof SetGoalSchema>;
