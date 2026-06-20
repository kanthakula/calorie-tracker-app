import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';
import { analyzeFood, currentProviderInfo, ConfigError } from './llm.js';

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

    // Dispatch to whichever provider is configured in .env (Gemini/OpenAI/Anthropic/Kimi).
    const { analysis } = await analyzeFood({ imageBase64, mimeType });
    return res.json(analysis);
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
