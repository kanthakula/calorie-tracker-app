// Multi-provider food-image analysis.
//
// Pick the provider in .env with LLM_PROVIDER = gemini | openai | anthropic | kimi.
// Each provider reads its own key + model from .env, re-read on every call so
// changes take effect without restarting the server. Every provider returns the
// same normalized JSON contract, so the rest of the app is provider-agnostic.

import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { readRuntimeConfig } from './config-store.js';

// Thrown when the provider/key/model isn't configured (→ HTTP 503, not 502).
export class ConfigError extends Error {}

export const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-opus-4-8',
  kimi: 'moonshot-v1-8k-vision-preview',
};
export const KIMI_DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1';
export const SUPPORTED_PROVIDERS = ['gemini', 'openai', 'anthropic', 'kimi'];

// Which .env variables back each provider (fallback when no UI value is set).
export const PROVIDER_ENV = {
  gemini: { key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL' },
  openai: { key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL' },
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
  kimi: { key: 'KIMI_API_KEY', model: 'KIMI_MODEL', baseURL: 'KIMI_BASE_URL' },
};

const BASE_PROMPT = [
  'You are a nutrition assistant for a calorie-tracking app.',
  'Analyze the food shown in this image.',
  'Estimate values for the single serving/portion visible in the image.',
  'If several items are shown, treat them together as one combined meal.',
  'estimated_calories: a whole number of kilocalories for the visible portion.',
  'protein_g, carbs_g, fat_g: estimated grams of protein, carbohydrates, and fat for the visible portion (whole numbers).',
  'healthiness_rating: integer 1-5 (1 = very unhealthy, 5 = very healthy).',
  'portion_recommendation: one short, practical sentence about portion size.',
  'confidence: how sure you are given image clarity ("low" | "medium" | "high").',
  'notes: one short sentence with any caveats or assumptions.',
  'If the image does not contain food, set food_name to "No food detected", all numbers to 0, and confidence to "low".',
].join(' ');

const JSON_INSTRUCTION =
  'Respond with ONLY a single JSON object (no markdown, no code fences) with exactly these keys: ' +
  'food_name (string), estimated_calories (number), protein_g (number), carbs_g (number), ' +
  'fat_g (number), healthiness_rating (number 1-5), portion_recommendation (string), ' +
  'confidence ("low"|"medium"|"high"), notes (string).';

// Gemini structured-output schema (forces the exact JSON shape).
const GEMINI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    food_name: { type: SchemaType.STRING },
    estimated_calories: { type: SchemaType.NUMBER },
    protein_g: { type: SchemaType.NUMBER },
    carbs_g: { type: SchemaType.NUMBER },
    fat_g: { type: SchemaType.NUMBER },
    healthiness_rating: { type: SchemaType.NUMBER },
    portion_recommendation: { type: SchemaType.STRING },
    confidence: { type: SchemaType.STRING, enum: ['low', 'medium', 'high'] },
    notes: { type: SchemaType.STRING },
  },
  required: [
    'food_name', 'estimated_calories', 'protein_g', 'carbs_g', 'fat_g',
    'healthiness_rating', 'portion_recommendation', 'confidence', 'notes',
  ],
};

// ---------- Helpers ----------
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Coerce/clamp any provider's output to the exact contract.
function normalizeAnalysis(data) {
  const d = data || {};
  const confidence = ['low', 'medium', 'high'].includes(d.confidence) ? d.confidence : 'low';
  return {
    food_name: String(d.food_name || 'Unknown food').slice(0, 120),
    estimated_calories: Math.round(clampNumber(d.estimated_calories, 0, 10000, 0)),
    protein_g: Math.round(clampNumber(d.protein_g, 0, 1000, 0)),
    carbs_g: Math.round(clampNumber(d.carbs_g, 0, 1000, 0)),
    fat_g: Math.round(clampNumber(d.fat_g, 0, 1000, 0)),
    healthiness_rating: Math.round(clampNumber(d.healthiness_rating, 1, 5, 3)),
    portion_recommendation: String(d.portion_recommendation || '').slice(0, 400),
    confidence,
    notes: String(d.notes || '').slice(0, 600),
  };
}

// Tolerant JSON parse for providers without a strict-schema mode.
function parseLooseJson(text) {
  if (text == null) throw new Error('Empty response from model.');
  let s = String(text).trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// ---------- Config ----------
// Precedence (highest first): owner's UI config (runtime-config.json) → .env → defaults.
// Both sources are re-read on every call, so changes take effect without a restart.
function resolveConfig() {
  dotenv.config({ override: true });
  const rc = readRuntimeConfig();
  const rcKeys = rc.keys || {};
  const rcModels = rc.models || {};
  const rcBaseURLs = rc.baseURLs || {};

  const provider = String(rc.provider || process.env.LLM_PROVIDER || 'gemini')
    .toLowerCase()
    .trim();
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new ConfigError(
      `Unknown provider "${provider}". Use one of: ${SUPPORTED_PROVIDERS.join(', ')}.`,
    );
  }

  const names = PROVIDER_ENV[provider];
  const env = (k) => (k && process.env[k] ? String(process.env[k]).trim() : '');

  const cfg = { provider };
  cfg.apiKey = String(rcKeys[provider] || env(names.key) || '').trim();
  cfg.model = String(rcModels[provider] || env(names.model) || DEFAULT_MODELS[provider]).trim();
  cfg.baseURL =
    provider === 'kimi'
      ? String(rcBaseURLs.kimi || env('KIMI_BASE_URL') || KIMI_DEFAULT_BASE_URL).trim()
      : undefined;
  return cfg;
}

// Public: what the server is currently configured to use (for logging / status).
export function currentProviderInfo() {
  try {
    const cfg = resolveConfig();
    return { provider: cfg.provider, model: cfg.model, configured: Boolean(cfg.apiKey) };
  } catch (err) {
    return { provider: 'unknown', model: '', configured: false, error: err.message };
  }
}

// ---------- Provider implementations ----------
async function analyzeGemini(cfg, imageBase64, mimeType) {
  const genAI = new GoogleGenerativeAI(cfg.apiKey);
  const model = genAI.getGenerativeModel({
    model: cfg.model,
    generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA },
  });
  const result = await model.generateContent([
    { text: BASE_PROMPT },
    { inlineData: { mimeType, data: imageBase64 } },
  ]);
  return JSON.parse(result.response.text());
}

// Shared by OpenAI and Kimi (Kimi exposes an OpenAI-compatible API via baseURL).
async function analyzeOpenAICompatible(cfg, imageBase64, mimeType) {
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const resp = await client.chat.completions.create({
    model: cfg.model,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${BASE_PROMPT} ${JSON_INSTRUCTION}` },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
  });
  return parseLooseJson(resp.choices?.[0]?.message?.content);
}

async function analyzeAnthropic(cfg, imageBase64, mimeType) {
  // Anthropic accepts image/jpeg|png|gif|webp only.
  if (!/^image\/(jpe?g|png|gif|webp)$/i.test(mimeType)) {
    throw new ConfigError('Anthropic supports JPEG, PNG, GIF, or WebP images only.');
  }
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const msg = await client.messages.create({
    model: cfg.model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: `${BASE_PROMPT} ${JSON_INSTRUCTION}` },
        ],
      },
    ],
  });
  const text = (msg.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseLooseJson(text);
}

// ---------- Public entry point ----------
export async function analyzeFood({ imageBase64, mimeType }) {
  const cfg = resolveConfig();
  if (!cfg.apiKey) {
    throw new ConfigError(
      `Food analysis is not configured for provider "${cfg.provider}". Set its API key in .env.`,
    );
  }

  let raw;
  if (cfg.provider === 'gemini') {
    raw = await analyzeGemini(cfg, imageBase64, mimeType);
  } else if (cfg.provider === 'openai' || cfg.provider === 'kimi') {
    raw = await analyzeOpenAICompatible(cfg, imageBase64, mimeType);
  } else if (cfg.provider === 'anthropic') {
    raw = await analyzeAnthropic(cfg, imageBase64, mimeType);
  }

  return { provider: cfg.provider, model: cfg.model, analysis: normalizeAnalysis(raw) };
}
