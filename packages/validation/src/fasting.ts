import { z } from 'zod';
import { CuidSchema } from './common.js';

/**
 * An intermittent-fasting session. `endAt = null` means the fast is currently
 * active. `targetHours` is the goal fasting window (e.g. 16 for a 16:8 protocol).
 */
export const FastSessionSchema = z.object({
  id: CuidSchema,
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  targetHours: z.number().int().min(1).max(48),
  createdAt: z.string().datetime().optional(),
});
export type FastSession = z.infer<typeof FastSessionSchema>;

export const StartFastSchema = z.object({
  targetHours: z.number().int().min(1).max(48).default(16),
});
export type StartFast = z.infer<typeof StartFastSchema>;

/** Current fasting picture: the active fast (if any) + recent completed ones. */
export const FastingStateSchema = z.object({
  active: FastSessionSchema.nullable(),
  recent: z.array(FastSessionSchema),
});
export type FastingState = z.infer<typeof FastingStateSchema>;
