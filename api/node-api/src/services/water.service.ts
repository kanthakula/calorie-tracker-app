import { prisma } from '@k21/db';
import type { LogWater, WaterDay } from '@k21/validation';

export async function getWater(userId: string, date: string): Promise<WaterDay> {
  const row = await prisma.waterDay.findUnique({ where: { userId_date: { userId, date } } });
  return { date, ml: row?.ml ?? 0 };
}

export async function logWater(userId: string, input: LogWater): Promise<WaterDay> {
  const current = await prisma.waterDay.findUnique({
    where: { userId_date: { userId, date: input.date } },
  });
  const base = current?.ml ?? 0;
  const next = Math.max(0, input.mode === 'set' ? input.ml : base + input.ml);

  const row = await prisma.waterDay.upsert({
    where: { userId_date: { userId, date: input.date } },
    update: { ml: next },
    create: { userId, date: input.date, ml: next },
  });
  return { date: row.date, ml: row.ml };
}
