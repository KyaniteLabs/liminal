/**
 * Start Studio backend only.
 * Canonical full Studio command: pnpm gui
 * Backend-only usage: node gui/start.js
 * Env: PORT=5174 (default), LIMINAL_CONFIG_PATH optional.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.LIMINAL_STUDIO_STATIC_DIR
  ? path.resolve(process.env.LIMINAL_STUDIO_STATIC_DIR)
  : path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 5174;

const app = createApp(undefined, PORT);

// In development, Vite runs separately and proxies /api to this server; in production we could serve static from gui/dist
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

if (fs.existsSync(path.join(staticDir, 'index.html'))) {
  app.use(express.static(staticDir));
  app.get(/^\/(?!api\/|preview\b).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Sinter GUI backend: http://localhost:${PORT}`);
  console.log(`  GET  /api/config`);
  console.log(`  POST /api/config`);
  console.log(`  GET  /api/gallery`);
  console.log(`  GET  /api/gallery/:project`);
  console.log(`  POST /api/preview/run`);
  console.log(`  POST /api/run`);
  console.log(`  POST /api/live-music/music`);
  console.log(`  POST /api/live-music/visuals`);
  console.log(`  GET  /preview?version=N`);
  console.log(`  GET  /api/health`);
  console.log(`\nFull Studio: pnpm gui`);
  if (fs.existsSync(path.join(staticDir, 'index.html'))) {
    console.log(`Static Studio frontend: ${staticDir}`);
  } else {
    console.log(`Backend-only mode is active; run the frontend separately with: cd gui && npm run dev`);
  }
});

// Keep server ref so process stays alive when backgrounded
void server;

// Handle shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
