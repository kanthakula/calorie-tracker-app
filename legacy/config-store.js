// Owner-managed runtime configuration, persisted server-side in runtime-config.json.
//
// This file holds the AI provider selection, per-provider models, and API keys
// set via the admin console. It is gitignored (it contains secrets) and is the
// override layer on top of .env: llm.js prefers these values, then falls back to
// .env, then to built-in defaults. Keys here are NEVER sent to the browser.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'runtime-config.json');

export function readRuntimeConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch (err) {
    console.error('Failed to read runtime-config.json:', err?.message || err);
  }
  return {};
}

export function writeRuntimeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
