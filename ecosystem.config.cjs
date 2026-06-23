// PM2 process definitions for the K21 stack (auto-start on reboot via PM2).
//
//   pnpm autostart:setup   → install PM2 + register Windows startup, then start & save
//   pm2 status             → see all processes
//   pm2 logs               → tail logs
//
// Postgres is NOT here — it runs in Docker with `restart: unless-stopped`, so it
// comes back when Docker Desktop starts on login. These three app processes read
// their config from the repo-root .env (the Node API and AI service load it
// themselves; the web bundle baked NEXT_PUBLIC_API_URL at build time).
const path = require('path');

const root = __dirname;
const isWin = process.platform === 'win32';
const venvPython = path.join(
  root,
  'api',
  'ai-service',
  isWin ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

/** Shared defaults for every process. */
const common = {
  autorestart: true,
  max_restarts: 10,
  restart_delay: 3000,
  // Give a crashed dependency (e.g. Postgres still booting) time before flapping.
  exp_backoff_restart_delay: 2000,
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'k21-ai',
      cwd: path.join(root, 'api', 'ai-service'),
      script: path.join(root, 'api', 'ai-service', 'run.py'),
      interpreter: venvPython,
      env: { PYTHONUNBUFFERED: '1', AI_SERVICE_PORT: '8000' },
    },
    {
      ...common,
      name: 'k21-node-api',
      cwd: root,
      script: path.join(root, 'api', 'node-api', 'dist', 'index.js'),
      interpreter: 'node',
    },
    {
      ...common,
      name: 'k21-web',
      cwd: path.join(root, 'apps', 'web'),
      script: nextBin,
      // -H 0.0.0.0 binds all interfaces so other LAN devices can reach it.
      args: 'start -p 3000 -H 0.0.0.0',
      interpreter: 'node',
    },
    {
      ...common,
      name: 'k21-https',
      cwd: root,
      // HTTPS reverse proxy in front of the web app (camera/voice need HTTPS).
      script: path.join(root, 'scripts', 'https-proxy.mjs'),
      interpreter: 'node',
      env: { HTTPS_PORT: '3443', WEB_PORT: '3000' },
    },
    {
      ...common,
      name: 'k21-tunnel',
      cwd: root,
      // Cloudflare Tunnel — publishes the web app at https://ojas.akulaz.ai.
      // Outbound connection to Cloudflare's edge: real TLS, no inbound ports
      // opened, no firewall changes. Config: C:\Users\srika\.cloudflared\config.yml
      script: 'C:/Program Files (x86)/cloudflared/cloudflared.exe',
      args: 'tunnel run ojas',
      interpreter: 'none',
    },
  ],
};
