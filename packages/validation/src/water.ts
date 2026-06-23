import { z } from 'zod';
import { IsoDateSchema } from './common.js';

/** A day's hydration total. */
export const WaterDaySchema = z.object({
  date: IsoDateSchema,
  ml: z.number().int().min(0).max(20000),
});
export type WaterDay = z.infer<typeof WaterDaySchema>;

/** Log water — `add` increments the day's total (default), `set` overwrites it. */
export const LogWaterSchema = z.object({
  date: IsoDateSchema,
  ml: z.number().int().min(-5000).max(20000),
  mode: z.enum(['add', 'set']).default('add'),
});
export type LogWater = z.infer<typeof LogWaterSchema>;
