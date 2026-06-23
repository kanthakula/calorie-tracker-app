import { prisma } from '@k21/db';
import {
  computeAdaptiveTDEE,
  targetsFromTDEE,
  type AdaptiveTDEE,
  type Targets,
} from '@k21/validation';
import { getProfile } from './profile.service.js';
import { weightPoints } from './weight.service.js';

const HISTORY_DAYS = 28;

function isoDaysBefore(reference: string, n: number): string {
  return new Date(Date.parse(reference) - n * 86_400_000).toISOString().slice(0, 10);
}

/** Daily intake totals (kcal) over the trailing window up to `reference`. */
async function intakeHistory(userId: string, reference: string) {
  const from = isoDaysBefore(reference, HISTORY_DAYS);
  const rows = await prisma.meal.groupBy({
    by: ['date'],
    where: { userId, date: { gte: from, lte: reference } },
    _sum: { calories: true },
  });
  return rows.map((r) => ({ date: r.date, intake: r._sum.calories ?? 0 }));
}

export type TargetSource = 'adaptive' | 'estimated' | 'manual';

export interface AdaptiveContext {
  effectiveTargets: Targets | null;
  adaptiveTdee: AdaptiveTDEE | null;
  targetSource: TargetSource;
}

/**
 * Resolve the targets to actually track against:
 *  - autoTargets OFF → the user's stored overrides ("manual").
 *  - autoTargets ON + enough data → adaptive TDEE measured from intake+weight ("adaptive").
 *  - otherwise → the Mifflin estimate ("estimated").
 */
export async function getAdaptiveContext(
  userId: string,
  reference: string,
): Promise<AdaptiveContext> {
  const { profile, effectiveTargets } = await getProfile(userId);

  if (!profile.autoTargets) {
    return { effectiveTargets, adaptiveTdee: null, targetSource: 'manual' };
  }

  const [days, weights] = await Promise.all([
    intakeHistory(userId, reference),
    weightPoints(userId),
  ]);
  const adaptiveTdee = computeAdaptiveTDEE({ days, weights });

  const weightKg = profile.currentWeightKg ?? weights[weights.length - 1]?.weightKg ?? null;
  if (adaptiveTdee && weightKg) {
    return {
      effectiveTargets: targetsFromTDEE(adaptiveTdee.tdee, profile.goal ?? 'maintain', weightKg),
      adaptiveTdee,
      targetSource: 'adaptive',
    };
  }

  return { effectiveTargets, adaptiveTdee, targetSource: 'estimated' };
}
