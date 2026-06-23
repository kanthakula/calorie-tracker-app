import { prisma } from '@k21/db';
import type { DailyGoal, SetGoal } from '@k21/validation';

const DEFAULT_GOAL = 2000;

/** Effective goal for a date: a date-specific override, else the standing default. */
export async function getGoal(userId: string, date: string | null): Promise<DailyGoal> {
  if (date) {
    const specific = await prisma.dailyGoal.findFirst({ where: { userId, date } });
    if (specific) return { date, calorieGoal: specific.calorieGoal };
  }
  const standing = await prisma.dailyGoal.findFirst({ where: { userId, date: null } });
  return { date: date ?? null, calorieGoal: standing?.calorieGoal ?? DEFAULT_GOAL };
}

/**
 * Whether the user has explicitly set a calorie goal for this date (a
 * date-specific override or a standing goal) — as opposed to the 2000 default.
 * Lets the summary fall back to the estimated/adaptive target when no manual
 * goal exists. Mirrors getGoal's lookup precedence.
 */
export async function hasGoalSet(userId: string, date: string | null): Promise<boolean> {
  if (date) {
    const specific = await prisma.dailyGoal.findFirst({ where: { userId, date } });
    if (specific) return true;
  }
  const standing = await prisma.dailyGoal.findFirst({ where: { userId, date: null } });
  return standing != null;
}

export async function setGoal(userId: string, input: SetGoal): Promise<DailyGoal> {
  const existing = await prisma.dailyGoal.findFirst({ where: { userId, date: input.date } });
  if (existing) {
    await prisma.dailyGoal.update({
      where: { id: existing.id },
      data: { calorieGoal: input.calorieGoal },
    });
  } else {
    await prisma.dailyGoal.create({
      data: { userId, date: input.date, calorieGoal: input.calorieGoal },
    });
  }
  return { date: input.date, calorieGoal: input.calorieGoal };
}
