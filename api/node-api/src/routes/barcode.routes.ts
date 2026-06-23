import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { lookupBarcode } from '../services/ai-service.client.js';

// Barcode lookups hit an external DB (Open Food Facts) via the AI service.
const barcodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many barcode lookups. Please slow down.' },
});

export const barcodeRouter = Router();

barcodeRouter.get(
  '/:code',
  requireUser,
  barcodeLimiter,
  asyncHandler(async (req, res) => {
    const code = (req.params.code ?? '').trim();
    if (!/^\d{6,14}$/.test(code)) {
      throw new BadRequestError('Invalid barcode. Expected 6–14 digits.');
    }
    res.json(await lookupBarcode(code));
  }),
);
