import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AnalyzeImageRequestSchema } from '@k21/validation';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { analyzeFood } from '../services/ai-service.client.js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB decoded

function base64Bytes(b64: string): number {
  const len = b64.length;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

// Image analysis is the most expensive call — rate-limit it per IP.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please slow down.' },
});

export const analyzeRouter = Router();

analyzeRouter.post(
  '/',
  requireUser,
  analyzeLimiter,
  validate(AnalyzeImageRequestSchema),
  asyncHandler(async (req, res) => {
    if (base64Bytes(req.body.imageBase64) > MAX_IMAGE_BYTES) {
      throw new BadRequestError('Image is too large. Please use an image under 4MB.');
    }
    // Forward to the Python AI service; it owns provider keys + the analysis.
    res.json(await analyzeFood(req.body));
  }),
);
