import { prisma } from '@k21/db';
import { computeTrend, type LogWeight, type WeightTrendPoint } from '@k21/validation';
import { NotFoundError } from '../lib/errors.js';

export interface WeightHistory {
  entries: { id: string; date: string; weightKg: number }[];
  trend: WeightTrendPoint[];
  latestKg: number | null;
}

/** Log (or update) a weight for a day — one entry per day. */
export async function logWeight(userId: string, input: LogWeight) {
  const row = await prisma.weightEntry.upsert({
    where: { userId_date: { userId, date: input.date } },
    update: { weightKg: input.weightKg },
    create: { userId, date: input.date, weightKg: input.weightKg },
  });
  return { id: row.id, date: row.date, weightKg: row.weightKg };
}

export async function listWeights(userId: string, limitDays = 180): Promise<WeightHistory> {
  const rows = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
    take: limitDays,
  });
  const entries = rows.map((r) => ({ id: r.id, date: r.date, weightKg: r.weightKg }));
  const trend = computeTrend(entries);
  const latestKg = entries.length ? entries[entries.length - 1]!.weightKg : null;
  return { entries, trend, latestKg };
}

export async function deleteWeight(userId: string, date: string): Promise<void> {
  const existing = await prisma.weightEntry.findFirst({ where: { userId, date } });
  if (!existing) throw new NotFoundError('Weight entry not found.');
  await prisma.weightEntry.delete({ where: { id: existing.id } });
}

/** Raw weight points (asc) for the adaptive engine. */
export async function weightPoints(userId: string): Promise<{ date: string; weightKg: number }[]> {
  const rows = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });
  return rows.map((r) => ({ date: r.date, weightKg: r.weightKg }));
}
