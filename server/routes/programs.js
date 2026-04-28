/*
 * SpotMe — Programs routes
 * ------------------------------------------------------------
 * Catalogue of fitness programs (Upper, Yoga, Cycling, etc.)
 * plus per-user run tracking.
 *   GET  /api/programs                  — list catalogue (?category=)
 *   GET  /api/programs/:id              — single program + sessions
 *   POST /api/programs/:id/start        — begin a run
 *   POST /api/programs/:id/finish       — finalize the run
 *   GET  /api/programs/runs/recent      — recent runs for current user
 * All routes require authentication.
 * ------------------------------------------------------------ */

import { Router } from 'express';
import { stmts } from '../db.js';
import { requireAuth, handler, ApiError } from './_shared.js';

export const programsRoutes = Router();
programsRoutes.use(requireAuth);

function publicProgram(p, sessions = []) {
  if (!p) return null;
  return {
    id:            p.id,
    category:      p.category,
    name:          p.name,
    difficulty:    p.difficulty,
    coverColor:    p.cover_color,
    coverImage:    p.cover_image,
    heroImage:     p.hero_image,
    totalMinutes:  p.total_minutes,
    totalCalories: p.total_calories,
    description:   p.description,
    sessions:      sessions.map(s => ({
      id:        s.id,
      name:      s.name,
      ord:       s.ord,
      sets:      s.sets,
      reps:      s.reps,
      minutes:   s.minutes,
      thumbnail: s.thumbnail,
      tips:      s.tips || null
    }))
  };
}

/* ---------- GET / ---------- */
programsRoutes.get('/', handler((req, res) => {
  const { category } = req.query;
  const rows = category && category !== 'all'
    ? stmts.listProgramsByCat.all(String(category))
    : stmts.listPrograms.all();
  res.json({ programs: rows.map(p => publicProgram(p)) });
}));

/* ---------- GET /runs/recent ----------
   Mounted before /:id so it doesn't collide with the slug route. */
programsRoutes.get('/runs/recent', handler((req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const rows = stmts.listRecentRuns.all(req.user.id, limit);
  res.json({
    runs: rows.map(r => ({
      id:              r.id,
      programId:       r.program_id,
      sessionId:       r.session_id,
      startedAt:       r.started_at,
      finishedAt:      r.finished_at,
      calories:        r.calories,
      durationSeconds: r.duration_seconds,
      avgBpm:          r.avg_bpm
    }))
  });
}));

/* ---------- GET /:id ---------- */
programsRoutes.get('/:id', handler((req, res) => {
  const program = stmts.getProgram.get(req.params.id);
  if (!program) throw new ApiError(404, 'Program not found.');
  const sessions = stmts.listProgramSessions.all(req.params.id);
  res.json({ program: publicProgram(program, sessions) });
}));

/* ---------- POST /:id/start ---------- */
programsRoutes.post('/:id/start', handler((req, res) => {
  const program = stmts.getProgram.get(req.params.id);
  if (!program) throw new ApiError(404, 'Program not found.');

  const sessionId = req.body?.sessionId || null;
  const result = stmts.insertProgramRun.run(req.user.id, req.params.id, sessionId);
  res.json({ runId: result.lastInsertRowid, programId: req.params.id, sessionId });
}));

/* ---------- POST /:id/finish ----------
   Body: { runId, calories, durationSeconds, avgBpm } */
programsRoutes.post('/:id/finish', handler((req, res) => {
  const { runId, calories, durationSeconds, avgBpm } = req.body || {};
  if (!runId) throw new ApiError(400, 'runId is required.');

  const existing = stmts.getProgramRun.get(Number(runId), req.user.id);
  if (!existing) throw new ApiError(404, 'Run not found.');
  if (existing.program_id !== req.params.id) {
    throw new ApiError(400, 'Run does not match this program.');
  }

  stmts.finishProgramRun.run(
    Number(calories) || 0,
    Number(durationSeconds) || 0,
    avgBpm == null ? null : Number(avgBpm),
    Number(runId),
    req.user.id
  );

  res.json({ ok: true, runId: Number(runId) });
}));
