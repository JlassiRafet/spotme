/*
 * Creates an Express app wired to the mocked DB (no listen, no Groq check).
 * Import this AFTER vi.mock('../server/db.js') is set up in the test file.
 */

import express from 'express';
import { authRoutes }    from '../../server/routes/auth.js';
import { sessionRoutes } from '../../server/routes/sessions.js';
import { profileRoutes } from '../../server/routes/profile.js';

export function makeApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth',     authRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/profile',  profileRoutes);

  // Central error handler — mirrors server.js exactly
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
