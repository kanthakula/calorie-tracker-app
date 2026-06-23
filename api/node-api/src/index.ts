import { createApp } from './app.js';
import { env } from './env.js';
import { adminEnabled } from './middleware/admin.js';

const app = createApp();

const server = app.listen(env.NODE_API_PORT, () => {
  console.log(`K21 Node API listening on http://localhost:${env.NODE_API_PORT}`);
  console.log(`  AI service:    ${env.AI_SERVICE_URL}`);
  console.log(`  Admin console: ${adminEnabled() ? 'enabled' : 'disabled (set ADMIN_PASSWORD)'}`);
});

// Graceful shutdown.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => process.exit(0));
  });
}
