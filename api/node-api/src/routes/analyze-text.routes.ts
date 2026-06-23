import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AnalyzeTextRequestSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { analyzeText } from '../services/ai-service.client.js';

const textLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

export const analyzeTextRouter = Router();

analyzeTextRouter.post(
  '/',
  requireUser,
  textLimiter,
  validate(AnalyzeTextRequestSchema),
  asyncHandler(async (req, res) => {
    res.json(await analyzeText(req.body.text));
  }),
);
