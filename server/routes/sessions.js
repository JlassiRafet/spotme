/*
 * SpotMe — chat sessions (history) routes
 * ------------------------------------------------------------
 * GET    /api/sessions           → list the user's sessions (lightweight)
 * GET    /api/sessions/:id       → full session with all messages
 * DELETE /api/sessions/:id       → delete a session and its messages
 *
 * All require a valid session token.
 * ------------------------------------------------------------ */

import express from 'express';
import { stmts } from '../db.js';
import { ApiError, requireAuth, handler } from './_shared.js';

export const sessionRoutes = express.Router();

/* ---------- GET /api/sessions ---------- */

sessionRoutes.get('/', requireAuth, handler((req, res) => {
  const rows = stmts.listSessions.all(req.user.id);
  // Frontend wants camelCase
  res.json({
    sessions: rows.map(r => ({
      id:        r.id,
      title:     r.title,
      tags:      r.tags ? r.tags.split(',').filter(Boolean) : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  });
}));

/* ---------- GET /api/sessions/:id ---------- */

sessionRoutes.get('/:id', requireAuth, handler((req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid session id.');

  const session = stmts.getSession.get(id, req.user.id);
  if (!session) throw new ApiError(404, 'Conversation not found.');

  const msgs = stmts.listMessages.all(id).map(m => ({
    id:            m.id,
    role:          m.role,
    content:       m.content,
    imageDataUrl:  m.image_data_url,
    structured:    m.structured_json ? JSON.parse(m.structured_json) : null,
    createdAt:     m.created_at
  }));

  res.json({
    session: {
      id:        session.id,
      title:     session.title,
      tags:      session.tags ? session.tags.split(',').filter(Boolean) : [],
      createdAt: session.created_at,
      updatedAt: session.updated_at
    },
    messages: msgs
  });
}));

/* ---------- DELETE /api/sessions/:id ---------- */

sessionRoutes.delete('/:id', requireAuth, handler((req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid session id.');

  const info = stmts.deleteSession.run(id, req.user.id);
  if (info.changes === 0) throw new ApiError(404, 'Conversation not found.');
  res.json({ ok: true });
}));
