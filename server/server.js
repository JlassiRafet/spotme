/*
 * SpotMe — local development API server
 * ------------------------------------------------------------
 * Node.js + Express + SQLite + Groq (Llama-powered).
 * Runs on http://localhost:8787.
 *
 * Routes live in routes/*.js, mounted below.
 * ------------------------------------------------------------ */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { authRoutes }     from './routes/auth.js';
import { chatRoutes }     from './routes/chat.js';
import { identifyRoutes } from './routes/identify.js';
import { sessionRoutes }  from './routes/sessions.js';
import { profileRoutes }  from './routes/profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------- env sanity check ---------- */
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey || apiKey === 'REPLACE_ME' || apiKey.length < 20) {
  console.error('\n[spotme] FATAL: GROQ_API_KEY is not set in .env');
  console.error('         1. Copy .env.example to .env');
  console.error('         2. Get a free key at https://console.groq.com/keys');
  console.error('         3. Paste it into .env, save, and try `npm start` again\n');
  process.exit(1);
}

const app = express();

/* ---------- middleware ---------- */
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origins.includes(origin)) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ---------- routes ---------- */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'spotme-api',
    provider: 'groq',
    chatModel:   process.env.GROQ_CHAT_MODEL   || 'llama-3.3-70b-versatile',
    visionModel: process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview',
    db: db.open ? 'open' : 'closed'
  });
});

app.use('/api/auth',       authRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/identify',   identifyRoutes);
app.use('/api/sessions',   sessionRoutes);
app.use('/api/profile',    profileRoutes);

/* Serve the frontend files from the parent folder. */
const frontendDir = path.resolve(__dirname, '..');
app.use(express.static(frontendDir, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jsx')) res.setHeader('Cache-Control', 'no-store');
  }
}));

/* ---------- error handler ---------- */
app.use((err, _req, res, _next) => {
  console.error('[spotme] Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

/* ---------- start ---------- */
const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`\n[spotme] API + frontend listening on http://localhost:${port}`);
  console.log(`[spotme] Chat model:   ${process.env.GROQ_CHAT_MODEL   || 'llama-3.3-70b-versatile'}`);
  console.log(`[spotme] Vision model: ${process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview'}`);
  console.log(`[spotme] Open http://localhost:${port} in your browser.\n`);
});
