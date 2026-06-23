// Thin HTTP client for the Python FastAPI AI service. The Node API never holds
// provider keys — it forwards image-analysis and AI-config requests here.
import {
  AdminConfigSchema,
  BarcodeProductSchema,
  MealAnalysisSchema,
  type AdminConfig,
  type AnalyzeImageRequest,
  type BarcodeProduct,
  type MealAnalysis,
  type UpdateAdminConfig,
} from '@k21/validation';
import { env } from '../env.js';
import { ConfigError, UpstreamError } from '../lib/errors.js';

const base = env.AI_SERVICE_URL.replace(/\/$/, '');

async function call<T>(path: string, init: RequestInit, parse: (data: unknown) => T): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-internal-token': env.AI_INTERNAL_TOKEN,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new UpstreamError('AI service is unreachable. Is it running on AI_SERVICE_URL?');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    let message = 'AI service request failed.';
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (typeof b.error === 'string') message = b.error;
      else if (typeof b.detail === 'string') message = b.detail;
    }
    // 503 from the AI service means it isn't configured (caller-fixable).
    if (res.status === 503 || res.status === 400) throw new ConfigError(message);
    throw new UpstreamError(message);
  }
  return parse(body);
}

export async function analyzeFood(input: AnalyzeImageRequest): Promise<MealAnalysis> {
  return call('/analyze-food', { method: 'POST', body: JSON.stringify(input) }, (d) =>
    MealAnalysisSchema.parse(d),
  );
}

export async function analyzeText(text: string): Promise<MealAnalysis> {
  return call('/parse-text', { method: 'POST', body: JSON.stringify({ text }) }, (d) =>
    MealAnalysisSchema.parse(d),
  );
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct> {
  return call(`/barcode/${encodeURIComponent(code)}`, { method: 'GET' }, (d) =>
    BarcodeProductSchema.parse(d),
  );
}

export async function getAiConfig(): Promise<AdminConfig> {
  return call('/admin/config', { method: 'GET' }, (d) => AdminConfigSchema.parse(d));
}

export async function updateAiConfig(payload: UpdateAdminConfig): Promise<{ ok: true }> {
  return call('/admin/config', { method: 'POST', body: JSON.stringify(payload) }, () => ({
    ok: true as const,
  }));
}

export async function testAiProvider(): Promise<unknown> {
  return call('/admin/test', { method: 'POST', body: '{}' }, (d) => d);
}
