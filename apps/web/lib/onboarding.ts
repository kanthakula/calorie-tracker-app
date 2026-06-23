import type { Profile } from '@k21/validation';

/** Set once a user has a complete profile (or skips), so the gate stops checking. */
export const ONBOARDED_FLAG = 'k21:onboarded';

/** A profile with no core stats hasn't been set up yet. */
export function isProfileNew(
  p: Pick<Profile, 'age' | 'heightCm' | 'currentWeightKg'>,
): boolean {
  return p.age == null && p.heightCm == null && p.currentWeightKg == null;
}
