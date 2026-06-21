import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';
import {
  analyzeFood,
  currentProviderInfo,
  ConfigError,
  SUPPORTED_PROVIDERS,
  DEFAULT_MODELS,
  PROVIDER_ENV,
  KIMI_DEFAULT_BASE_URL,
} from './llm.js';
import { readRuntimeConfig, writeRuntimeConfig } from './config-store.js';

// Load .env at startup.
dotenv.config();

// Resolve __dirname in an ES module context.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

// JSON body parser sized for a base64 image (~4MB -> ~5.5MB encoded, plus slack).
app.use(express.json({ limit: '8mb' }));

// Serve all static assets (the single-page UI) from public/.
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ---------- Helpers ----------
function base64Bytes(b64) {
  if (!b64) return 0;
  const len = b64.length;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

// ---------- Routes ----------
app.post('/api/analyze-food', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};

    if (!imageBase64 || !mimeType) {
      return res
        .status(400)
        .json({ error: 'Missing image. Send JSON with { imageBase64, mimeType }.' });
    }
    if (!/^image\/(jpe?g|png|webp|heic|heif)$/i.test(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, or WebP.' });
    }
    if (base64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Image is too large. Please use an image under 4MB.' });
    }

    // Dispatch to whichever provider is configured (Gemini/OpenAI/Anthropic/Kimi).
    const { provider, model, analysis } = await analyzeFood({ imageBase64, mimeType });
    return res.json({ ...analysis, provider, model });
  } catch (err) {
    // A configuration problem is the caller's to fix (503); anything else is upstream (502).
    // Log server-side only; never echo the raw error (or key) back to the client.
    console.error('analyze-food failed:', err?.message || err);
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: err.message });
    }
    return res
      .status(502)
      .json({ error: 'Could not analyze the image right now. Please try again in a moment.' });
  }
});

// ---------- Admin console (owner only) ----------
// Gated by ADMIN_PASSWORD in .env. Login mints a short-lived in-memory token;
// every config read/write requires it. API keys are never returned to the browser.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const adminTokens = new Map(); // token -> expiresAt

// Tiny built-in image used only to test that a provider/key works.
const TEST_IMAGE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAB3CAILXAYjpQAAAABJRU5ErkJggg==';

function constantTimeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isValidAdminToken(req) {
  const token = req.headers['x-admin-token'];
  if (!token || typeof token !== 'string') return false;
  const expiresAt = adminTokens.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res
      .status(503)
      .json({ error: 'Admin console is disabled. Set ADMIN_PASSWORD in .env and restart.' });
  }
  if (!isValidAdminToken(req)) {
    return res.status(401).json({ error: 'Not authorized. Please log in.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res
      .status(503)
      .json({ error: 'Admin console is disabled. Set ADMIN_PASSWORD in .env and restart.' });
  }
  const { password } = req.body || {};
  if (typeof password !== 'string' || !constantTimeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL_MS);
  return res.json({ token, expiresInMs: ADMIN_TOKEN_TTL_MS });
});

// Current config, with keys MASKED (only whether each is set, and from where).
app.get('/api/admin/config', requireAdmin, (req, res) => {
  const rc = readRuntimeConfig();
  const env = (k) => (k && process.env[k] ? String(process.env[k]).trim() : '');
  const providers = SUPPORTED_PROVIDERS.map((p) => {
    const names = PROVIDER_ENV[p];
    const keyFromUi = (rc.keys && rc.keys[p]) || '';
    const keyFromEnv = env(names.key);
    return {
      id: p,
      model: (rc.models && rc.models[p]) || env(names.model) || DEFAULT_MODELS[p],
      defaultModel: DEFAULT_MODELS[p],
      hasKey: Boolean(keyFromUi || keyFromEnv),
      keySource: keyFromUi ? 'ui' : keyFromEnv ? 'env' : 'none',
    };
  });
  return res.json({
    activeProvider: rc.provider || process.env.LLM_PROVIDER || 'gemini',
    providers,
    kimiBaseURL: (rc.baseURLs && rc.baseURLs.kimi) || env('KIMI_BASE_URL') || KIMI_DEFAULT_BASE_URL,
  });
});

// Update config. Keys are only changed when a new non-empty value is sent;
// send null to clear a key (revert to .env / unset).
app.post('/api/admin/config', requireAdmin, (req, res) => {
  const { provider, models, keys, kimiBaseURL } = req.body || {};
  const rc = readRuntimeConfig();
  rc.models = rc.models || {};
  rc.keys = rc.keys || {};
  rc.baseURLs = rc.baseURLs || {};

  if (provider !== undefined) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Unknown provider.' });
    }
    rc.provider = provider;
  }
  if (models && typeof models === 'object') {
    for (const p of SUPPORTED_PROVIDERS) {
      if (typeof models[p] === 'string') {
        const m = models[p].trim();
        if (m) rc.models[p] = m;
        else delete rc.models[p];
      }
    }
  }
  if (keys && typeof keys === 'object') {
    for (const p of SUPPORTED_PROVIDERS) {
      if (keys[p] === null) delete rc.keys[p]; // explicit clear
      else if (typeof keys[p] === 'string' && keys[p].trim()) rc.keys[p] = keys[p].trim();
    }
  }
  if (typeof kimiBaseURL === 'string' && kimiBaseURL.trim()) {
    rc.baseURLs.kimi = kimiBaseURL.trim();
  }

  writeRuntimeConfig(rc);
  return res.json({ ok: true });
});

// Run a real (tiny) analysis to confirm the active provider + key work.
app.post('/api/admin/test', requireAdmin, async (req, res) => {
  try {
    const { provider, model, analysis } = await analyzeFood({
      imageBase64: TEST_IMAGE_PNG,
      mimeType: 'image/png',
    });
    return res.json({ ok: true, provider, model, sample: analysis });
  } catch (err) {
    console.error('admin test failed:', err?.message || err);
    const status = err instanceof ConfigError ? 400 : 502;
    return res.status(status).json({ ok: false, error: err.message || 'Test failed.' });
  }
});

// Admin console page.
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// App shell.
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---------- Server startup (HTTP + self-signed HTTPS) ----------
// HTTPS is what lets the live webcam (getUserMedia) work on phones, since
// browsers only expose the camera in a "secure context" (https or localhost).

function localIPv4s() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

// Load a cached self-signed cert, or generate one (valid for localhost + LAN IPs).
function ensureCredentials() {
  const certDir = path.join(__dirname, 'certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...localIPv4s().map((ip) => ({ type: 7, ip })),
  ];
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });

  fs.mkdirSync(certDir, { recursive: true });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

http.createServer(app).listen(HTTP_PORT, () => {
  console.log(`HTTP  : http://localhost:${HTTP_PORT}`);
  const info = currentProviderInfo();
  if (!info.configured) {
    console.warn(
      `Warning: provider "${info.provider}" has no API key set — /api/analyze-food will return 503.`,
    );
  } else {
    console.log(`AI provider: ${info.provider} (model: ${info.model}) — configurable in .env`);
  }
});

try {
  const credentials = ensureCredentials();
  https.createServer(credentials, app).listen(HTTPS_PORT, () => {
    console.log(`HTTPS : https://localhost:${HTTPS_PORT}`);
    for (const ip of localIPv4s()) {
      console.log(`        https://${ip}:${HTTPS_PORT}  <-- open this on your phone (for webcam)`);
    }
    console.log('Note: it is a self-signed cert, so accept the browser warning once.');
  });
} catch (err) {
  console.warn('HTTPS server not started:', err?.message || err);
}
