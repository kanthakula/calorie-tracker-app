// HTTPS reverse proxy for the K21 web app.
//
// Terminates TLS (self-signed cert covering localhost + this machine's LAN IPs)
// and forwards everything to the Next.js app on http://127.0.0.1:3000. Next in
// turn proxies /api/* to the Node API, so one HTTPS origin fronts the whole app.
//
// Why: browsers only expose the camera/microphone in a "secure context"
// (HTTPS or localhost). Opening https://<LAN-IP>:3443 from a phone gives the
// camera (AI snap) and voice logging — over plain http they're blocked.
//
// Self-signed means each device shows a one-time "not private" warning to accept.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const selfsigned = require('selfsigned');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const WEB_HOST = process.env.WEB_HOST || '127.0.0.1';
const WEB_PORT = Number(process.env.WEB_PORT || 3000);

function localIPv4s() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

function ensureCert() {
  const certDir = path.join(root, 'certs');
  const keyPath = path.join(certDir, 'https-key.pem');
  const certPath = path.join(certDir, 'https-cert.pem');
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

const credentials = ensureCert();

const server = https.createServer(credentials, (req, res) => {
  const proxyReq = http.request(
    { host: WEB_HOST, port: WEB_PORT, method: req.method, path: req.url, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Web app is not reachable yet. Is it running on :' + WEB_PORT + '?');
  });
  req.pipe(proxyReq);
});

// Forward WebSocket upgrades (harmless if unused by `next start`).
server.on('upgrade', (req, socket, head) => {
  const proxyReq = http.request({
    host: WEB_HOST,
    port: WEB_PORT,
    method: req.method,
    path: req.url,
    headers: req.headers,
  });
  proxyReq.on('upgrade', (proxyRes, proxySocket) => {
    const headers = Object.entries(proxyRes.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);
    if (head && head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });
  proxyReq.on('error', () => socket.destroy());
  proxyReq.end();
});

server.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`K21 HTTPS proxy on https://localhost:${HTTPS_PORT} -> http://${WEB_HOST}:${WEB_PORT}`);
  for (const ip of localIPv4s()) {
    console.log(`  https://${ip}:${HTTPS_PORT}  <-- open on your phone (accept the self-signed warning once)`);
  }
});
