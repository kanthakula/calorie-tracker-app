import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve __dirname in an ES module context.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static assets (the single-page UI) from public/.
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Explicit route for the app shell.
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`K21 Calorie Tracker running at http://localhost:${PORT}`);
});
