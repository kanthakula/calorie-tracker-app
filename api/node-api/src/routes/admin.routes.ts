// Owner-only admin routes. Login is local (ADMIN_PASSWORD); config/test are
// proxied to the AI service, which owns provider keys. Keys never transit here.
import { Router } from 'express';
import { AdminLoginSchema, UpdateAdminConfigSchema, UpdateAppSettingsSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { adminLogin, requireAdmin } from '../middleware/admin.js';
import { validate } from '../middleware/validate.js';
import { getAiConfig, testAiProvider, updateAiConfig } from '../services/ai-service.client.js';
import { getSettings, updateSettings } from '../services/settings.service.js';

export const adminRouter = Router();

adminRouter.post(
  '/login',
  validate(AdminLoginSchema),
  asyncHandler(async (req, res) => {
    res.json(adminLogin(req.body.username, req.body.password));
  }),
);

adminRouter.get(
  '/config',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getAiConfig());
  }),
);

adminRouter.post(
  '/config',
  requireAdmin,
  validate(UpdateAdminConfigSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateAiConfig(req.body));
  }),
);

adminRouter.post(
  '/test',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await testAiProvider());
  }),
);

// --- App settings (branding, theme, feature flags) ---
adminRouter.get(
  '/settings',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  }),
);

adminRouter.post(
  '/settings',
  requireAdmin,
  validate(UpdateAppSettingsSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateSettings(req.body));
  }),
);
