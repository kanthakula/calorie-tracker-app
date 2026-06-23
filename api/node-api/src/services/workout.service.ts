import { prisma } from '@k21/db';
import type { CreateWorkout, UpdateWorkout, Workout } from '@k21/validation';
import { NotFoundError } from '../lib/errors.js';

type WorkoutRow = {
  id: string;
  name: string;
  activity: string;
  date: string;
  durationMin: number;
  caloriesBurned: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

function toWorkout(w: WorkoutRow): Workout {
  return {
    id: w.id,
    name: w.name,
    activity: w.activity,
    date: w.date,
    durationMin: w.durationMin,
    caloriesBurned: w.caloriesBurned,
    source: w.source as Workout['source'],
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export async function listWorkouts(userId: string, date: string): Promise<Workout[]> {
  const rows = await prisma.workout.findMany({
    where: { userId, date },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toWorkout);
}

export async function createWorkout(userId: string, input: CreateWorkout): Promise<Workout> {
  const row = await prisma.workout.create({ data: { ...input, userId } });
  return toWorkout(row);
}

export async function updateWorkout(
  userId: string,
  id: string,
  input: UpdateWorkout,
): Promise<Workout> {
  const existing = await prisma.workout.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Workout not found.');
  const row = await prisma.workout.update({ where: { id }, data: input });
  return toWorkout(row);
}

export async function deleteWorkout(userId: string, id: string): Promise<void> {
  const existing = await prisma.workout.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Workout not found.');
  await prisma.workout.delete({ where: { id } });
}

/** Total active calories burned on a day (sum of workouts). */
export async function burnedForDate(userId: string, date: string): Promise<number> {
  const agg = await prisma.workout.aggregate({
    where: { userId, date },
    _sum: { caloriesBurned: true },
  });
  return agg._sum.caloriesBurned ?? 0;
}
