/**
 * Full-Stack Application Server
 * Express Backend API + Vite Frontend Middleware on Port 3000
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './src/backend/db.ts';
import { apiRouter } from './src/backend/apiRouter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize SQLite database and seed data
  console.log('[Database] Initializing relational schema...');
  initDatabase();
  console.log('[Database] Schema ready and seed data verified.');

  // Global middleware
  app.use(express.json({ limit: '10mb' }));

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const start = performance.now();
      res.on('finish', () => {
        const duration = (performance.now() - start).toFixed(1);
        console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
      });
    }
    next();
  });

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Vite Integration
  if (!isProd) {
    console.log('[Vite] Initializing Vite development middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Static] Serving production build from dist...');
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Static] Warning: dist directory not found. Please run npm run build.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Real-Time Financial Fraud Detection Platform listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
