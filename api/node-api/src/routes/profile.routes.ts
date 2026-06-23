import { Router } from 'express';
import { UpdateProfileSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getProfile, updateProfile } from '../services/profile.service.js';
import { getAdaptiveContext } from '../services/adaptive.service.js';

export const profileRouter = Router();
profileRouter.use(requireUser);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const base = await getProfile(req.user!.id);
    const adaptive = await getAdaptiveContext(req.user!.id, today());
    // effectiveTargets reflects the adaptive engine when available.
    res.json({
      ...base,
      effectiveTargets: adaptive.effectiveTargets,
      adaptiveTdee: adaptive.adaptiveTdee,
      targetSource: adaptive.targetSource,
    });
  }),
);

profileRouter.put(
  '/',
  validate(UpdateProfileSchema),
  asyncHandler(async (req, res) => {
    const base = await updateProfile(req.user!.id, req.body);
    const adaptive = await getAdaptiveContext(req.user!.id, today());
    res.json({
      ...base,
      effectiveTargets: adaptive.effectiveTargets,
      adaptiveTdee: adaptive.adaptiveTdee,
      targetSource: adaptive.targetSource,
    });
  }),
);
