import bcrypt from 'bcryptjs';
import { prisma } from '@k21/db';
import type { AuthResponse, Login, PublicUser, Register } from '@k21/validation';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { signToken } from '../lib/jwt.js';

function toPublicUser(u: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}): PublicUser {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString() };
}

export async function register(input: Register): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with that email already exists.');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name ?? null, passwordHash },
  });
  // New users get a sensible default standing goal.
  await prisma.dailyGoal.create({ data: { userId: user.id, date: null, calorieGoal: 2000 } });

  const token = signToken({ sub: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}

export async function login(input: Login): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new UnauthorizedError('Invalid email or password.');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid email or password.');

  const token = signToken({ sub: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Account not found.');
  return toPublicUser(user);
}
