import { prisma } from '@k21/db';
import {
  computeTargets,
  resolveTargets,
  type Profile,
  type Targets,
  type UpdateProfile,
} from '@k21/validation';

export interface ProfileResult {
  profile: Profile;
  /** Suggestion from the stats (Mifflin–St Jeor); null until enough data. */
  suggestedTargets: Targets | null;
  /** What we actually track against (overrides or suggestion). */
  effectiveTargets: Targets | null;
}

type ProfileRow = {
  displayName: string | null;
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  activityLevel: string;
  goal: string;
  dietPattern: string;
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbTarget: number | null;
  fatTarget: number | null;
  waterTargetMl: number | null;
  autoTargets: boolean;
};

function toProfile(row: ProfileRow): Profile {
  return {
    displayName: row.displayName,
    age: row.age,
    sex: row.sex as Profile['sex'],
    heightCm: row.heightCm,
    currentWeightKg: row.currentWeightKg,
    targetWeightKg: row.targetWeightKg,
    activityLevel: row.activityLevel as Profile['activityLevel'],
    goal: row.goal as Profile['goal'],
    dietPattern: row.dietPattern as Profile['dietPattern'],
    calorieTarget: row.calorieTarget,
    proteinTarget: row.proteinTarget,
    carbTarget: row.carbTarget,
    fatTarget: row.fatTarget,
    waterTargetMl: row.waterTargetMl,
    autoTargets: row.autoTargets,
  };
}

function withTargets(profile: Profile): ProfileResult {
  return {
    profile,
    suggestedTargets: computeTargets(profile),
    effectiveTargets: resolveTargets(profile),
  };
}

export async function getProfile(userId: string): Promise<ProfileResult> {
  let row = await prisma.profile.findUnique({ where: { userId } });
  if (!row) row = await prisma.profile.create({ data: { userId } });
  return withTargets(toProfile(row));
}

export async function updateProfile(
  userId: string,
  input: UpdateProfile,
): Promise<ProfileResult> {
  const row = await prisma.profile.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
  return withTargets(toProfile(row));
}

/** Effective targets for a user (used by the daily summary/alerts). */
export async function getEffectiveTargets(userId: string): Promise<Targets | null> {
  const { effectiveTargets } = await getProfile(userId);
  return effectiveTargets;
}
