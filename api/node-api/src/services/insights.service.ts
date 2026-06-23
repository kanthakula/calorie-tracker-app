import { prisma } from '@k21/db';
import { computeBMR, computeStreak, computeTrend, type Streak, type WeeklyCheckin } from '@k21/validation';
import { getProfile } from './profile.service.js';
import { getAdaptiveContext } from './adaptive.service.js';

function isoDaysBefore(reference: string, n: number): string {
  return new Date(Date.parse(reference) - n * 86_400_000).toISOString().slice(0, 10);
}

/** Current logging streak (consecutive days ending at `today` with a meal). */
export async function getStreak(userId: string, today: string): Promise<Streak> {
  const from = isoDaysBefore(today, 90);
  const rows = await prisma.meal.findMany({
    where: { userId, date: { gte: from, lte: today } },
    select: { date: true },
    distinct: ['date'],
  });
  const dates = rows.map((r) => r.date);
  return { current: computeStreak(dates, today), loggedToday: dates.includes(today) };
}

/** Weekly check-in for the 7 days ending at `weekEnd`. */
export async function getWeekly(userId: string, weekEnd: string): Promise<WeeklyCheckin> {
  const weekStart = isoDaysBefore(weekEnd, 6);

  const [intakeRows, burnRows, weightRows, { profile }, adaptive] = await Promise.all([
    prisma.meal.groupBy({
      by: ['date'],
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      _sum: { calories: true },
    }),
    prisma.workout.groupBy({
      by: ['date'],
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      _sum: { caloriesBurned: true },
    }),
    prisma.weightEntry.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      orderBy: { date: 'asc' },
    }),
    getProfile(userId),
    getAdaptiveContext(userId, weekEnd),
  ]);

  const daysLogged = intakeRows.length;
  const totalIntake = intakeRows.reduce((s, r) => s + (r._sum.calories ?? 0), 0);
  const totalBurned = burnRows.reduce((s, r) => s + (r._sum.caloriesBurned ?? 0), 0);
  const avgIntake = daysLogged > 0 ? Math.round(totalIntake / daysLogged) : 0;
  const avgBurned = Math.round(totalBurned / 7);

  const restingBurn = computeBMR(profile);
  const avgNet = restingBurn == null ? null : avgIntake - restingBurn - avgBurned;

  let weightTrendChangeKg: number | null = null;
  if (weightRows.length >= 2) {
    const trend = computeTrend(weightRows.map((w) => ({ date: w.date, weightKg: w.weightKg })));
    weightTrendChangeKg =
      Math.round((trend[trend.length - 1]!.trendKg - trend[0]!.trendKg) * 100) / 100;
  }

  return {
    weekStart,
    weekEnd,
    avgIntake,
    avgBurned,
    daysLogged,
    avgNet,
    weightTrendChangeKg,
    adaptiveTdee: adaptive.adaptiveTdee,
    message: buildWeeklyMessage({ daysLogged, avgIntake, weightTrendChangeKg }),
  };
}

function buildWeeklyMessage(d: {
  daysLogged: number;
  avgIntake: number;
  weightTrendChangeKg: number | null;
}): string {
  if (d.daysLogged === 0) return 'No days logged this week — log meals to unlock your weekly insight.';
  const parts: string[] = [`You logged ${d.daysLogged} of 7 days, averaging ${d.avgIntake} kcal.`];
  if (d.weightTrendChangeKg != null) {
    if (d.weightTrendChangeKg <= -0.1) parts.push(`Weight trend down ${Math.abs(d.weightTrendChangeKg)} kg.`);
    else if (d.weightTrendChangeKg >= 0.1) parts.push(`Weight trend up ${d.weightTrendChangeKg} kg.`);
    else parts.push('Weight trend held steady.');
  }
  if (d.daysLogged < 5) parts.push('Logging a few more days will sharpen your adaptive targets.');
  return parts.join(' ');
}
