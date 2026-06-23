// Public, read-only app settings (app name, theme, accent, feature flags).
// Non-secret — the web/mobile clients fetch this to brand themselves and gate
// features. Writes go through the admin routes.
import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { getSettings } from '../services/settings.service.js';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  }),
);
