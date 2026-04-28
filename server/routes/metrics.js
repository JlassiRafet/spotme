/*
 * SpotMe — Daily metrics routes
 * ------------------------------------------------------------
 * Per-day step counts, water, calories, resting heart rate.
 *   GET  /api/metrics?days=7  — recent metrics for the user
 *   POST /api/metrics         — upsert today's row
 * All routes require authentication.
 * ------------------------------------------------------------ */

import { Router } from 'express';
import { stmts } from '../db.js';
import { requireAuth, handler, ApiError } from './_shared.js';

export const metricsRoutes = Router();
metricsRoutes.use(requireAuth);

function isoDay(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function publicMetric(row) {
  if (!row) return null;
  return {
    day:         row.day,
    steps:       row.steps || 0,
    waterLiters: row.water_liters || 0,
    calories:    row.calories || 0,
    restingBpm:  row.resting_bpm
  };
}

/* ---------- GET / ----------
   Returns the last `days` days of metrics, oldest → newest, ensuring
   one entry per day (zero-filled for missing days). */
metricsRoutes.get('/', handler((req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const cutoffDate = new Date(Date.now() - (days - 1) * 86400000);
  cutoffDate.setUTCHours(0, 0, 0, 0);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const rows = stmts.listDailyMetrics.all(req.user.id, cutoffStr);
  const byDay = new Map();
  for (const r of rows) byDay.set(r.day, publicMetric(r));

  // Build chronological array with zero-fills.
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoffDate.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push(byDay.get(key) || {
      day: key, steps: 0, waterLiters: 0, calories: 0, restingBpm: null
    });
  }

  res.json({ metrics: out, today: publicMetric(byDay.get(isoDay()) || null) });
}));

/* ---------- POST / ----------
   Body: { day?, steps?, waterLiters?, calories?, restingBpm? }
   Defaults `day` to today (UTC). Any omitted field preserves the
   existing value (handled in the upsert SQL via COALESCE). */
metricsRoutes.post('/', handler((req, res) => {
  const body = req.body || {};
  const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
    ? body.day
    : isoDay();

  const steps        = body.steps        != null ? Number(body.steps)        : null;
  const waterLiters  = body.waterLiters  != null ? Number(body.waterLiters)  : null;
  const calories     = body.calories     != null ? Number(body.calories)     : null;
  const restingBpm   = body.restingBpm   != null ? Number(body.restingBpm)   : null;

  if (steps != null && (Number.isNaN(steps) || steps < 0)) {
    throw new ApiError(400, 'steps must be a non-negative number.');
  }
  if (waterLiters != null && (Number.isNaN(waterLiters) || waterLiters < 0)) {
    throw new ApiError(400, 'waterLiters must be a non-negative number.');
  }

  stmts.upsertDailyMetric.run({
    user_id: req.user.id,
    day,
    steps,
    water_liters: waterLiters,
    calories,
    resting_bpm: restingBpm
  });

  const fresh = stmts.getDailyMetric.get(req.user.id, day);
  res.json({ metric: publicMetric(fresh) });
}));
