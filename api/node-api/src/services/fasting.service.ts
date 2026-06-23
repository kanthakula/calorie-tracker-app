import { prisma } from '@k21/db';
import type { FastSession, FastingState } from '@k21/validation';
import { BadRequestError } from '../lib/errors.js';

type FastRow = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  targetHours: number;
  createdAt: Date;
};

function toSession(r: FastRow): FastSession {
  return {
    id: r.id,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt ? r.endAt.toISOString() : null,
    targetHours: r.targetHours,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getFastingState(userId: string): Promise<FastingState> {
  const [active, recent] = await Promise.all([
    prisma.fastSession.findFirst({
      where: { userId, endAt: null },
      orderBy: { startAt: 'desc' },
    }),
    prisma.fastSession.findMany({
      where: { userId, endAt: { not: null } },
      orderBy: { endAt: 'desc' },
      take: 14,
    }),
  ]);
  return {
    active: active ? toSession(active) : null,
    recent: recent.map(toSession),
  };
}

export async function startFast(
  userId: string,
  targetHours: number,
): Promise<FastSession> {
  // Enforce a single active fast — close any stray open one first.
  await prisma.fastSession.updateMany({
    where: { userId, endAt: null },
    data: { endAt: new Date() },
  });
  const row = await prisma.fastSession.create({
    data: { userId, startAt: new Date(), targetHours },
  });
  return toSession(row);
}

export async function endFast(userId: string): Promise<FastSession> {
  const active = await prisma.fastSession.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: 'desc' },
  });
  if (!active) throw new BadRequestError('No active fast to end.');
  const row = await prisma.fastSession.update({
    where: { id: active.id },
    data: { endAt: new Date() },
  });
  return toSession(row);
}
