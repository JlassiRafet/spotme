/*
 * SpotMe — Tracker routes
 * ------------------------------------------------------------
 * Workout logging, timeline, stats, and streak endpoints.
 * All routes require authentication.
 * ------------------------------------------------------------ */

import { Router } from 'express';
import { stmts } from '../db.js';
import { requireAuth, handler, ApiError } from './_shared.js';

export const trackerRoutes = Router();
trackerRoutes.use(requireAuth);

/* ---------- POST /api/tracker/log ----------
   Body: { exercise, sets, weight, reps, muscleGroup, machineId, source }
   "sets" can be:
     - An array of objects: [{ reps: 10, weight: 60 }, ...]
     - An array of numbers (reps only): [10, 8, 6]
   OR provide flat reps + weight for a quick single-set log.
*/
trackerRoutes.post('/log', handler(async (req, res) => {
  const { exercise, sets, weight, reps, muscleGroup, machineId, source } = req.body;

  if (!exercise || typeof exercise !== 'string' || !exercise.trim()) {
    throw new ApiError(400, 'Exercise name is required.');
  }

  // Normalize sets into [{reps, weight}, ...]
  let setsArr = [];
  if (Array.isArray(sets) && sets.length > 0) {
    setsArr = sets.map(s => {
      if (typeof s === 'object' && s !== null) {
        return { reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 };
      }
      // Plain number = reps only, use provided weight or 0
      return { reps: Number(s) || 0, weight: Number(weight) || 0 };
    });
  } else if (reps || weight) {
    setsArr = [{ reps: Number(reps) || 0, weight: Number(weight) || 0 }];
  }

  if (setsArr.length === 0) {
    throw new ApiError(400, 'At least one set is required.');
  }

  const result = stmts.insertWorkout.run({
    user_id: req.user.id,
    exercise: exercise.trim(),
    sets_json: JSON.stringify(setsArr),
    muscle_group: (muscleGroup || '').trim() || null,
    machine_id: machineId || null,
    source: source || 'manual',
    logged_at: Math.floor(Date.now() / 1000)
  });

  res.json({
    ok: true,
    workout: {
      id: result.lastInsertRowid,
      exercise: exercise.trim(),
      sets: setsArr,
      muscleGroup: (muscleGroup || '').trim() || null,
      source: source || 'manual'
    }
  });
}));

/* ---------- GET /api/tracker ----------
   Query: ?days=7  (default 7, max 90)
   Returns workouts grouped by day.
*/
trackerRoutes.get('/', handler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const now = Math.floor(Date.now() / 1000);
  const start = now - days * 86400;

  const rows = stmts.getWorkoutsByRange.all(req.user.id, start, now);

  // Group by calendar day
  const grouped = {};
  for (const row of rows) {
    const d = new Date(row.logged_at * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: row.id,
      exercise: row.exercise,
      sets: safeParse(row.sets_json),
      muscleGroup: row.muscle_group,
      machineId: row.machine_id,
      source: row.source,
      loggedAt: row.logged_at
    });
  }

  // Recent exercises for autocomplete
  const recent = stmts.getRecentExercises.all(req.user.id).map(r => ({
    exercise: r.exercise,
    lastSets: safeParse(r.sets_json),
    muscleGroup: r.muscle_group
  }));

  res.json({ ok: true, days: grouped, recentExercises: recent });
}));

/* ---------- GET /api/tracker/stats ----------
   Returns: weekTotal, streak, bestStreak, prs, topMuscle, suggestions
*/
trackerRoutes.get('/stats', handler(async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);
  const startOfDayTs = Math.floor(startOfDay.getTime() / 1000);

  const weekAgo = now - 7 * 86400;
  const twoWeeksAgo = now - 14 * 86400;
  const monthAgo = now - 30 * 86400;

  // 1. Weekly Activity (last 7 days)
  const last7DaysLogs = stmts.getWorkoutsByRange.all(req.user.id, weekAgo, now);
  const weeklyActivity = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date((now - i * 86400) * 1000);
    const dayName = dayNames[d.getDay()];
    const dateStr = isoDate(d);
    const count = last7DaysLogs.filter(l => isoDate(new Date(l.logged_at * 1000)) === dateStr).length;
    weeklyActivity.push({
      day: dayName,
      count,
      isToday: i === 0,
      date: dateStr
    });
  }

  // 2. Trend vs Last Week
  const weekTotal = last7DaysLogs.length;
  const lastWeekLogs = stmts.getWorkoutsByRange.all(req.user.id, twoWeeksAgo, weekAgo);
  const lastWeekTotal = lastWeekLogs.length;
  const trendPercent = lastWeekTotal === 0 ? (weekTotal > 0 ? 100 : 0) : Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100);

  // 3. Muscle Distribution (last 30 days)
  const monthLogs = stmts.getWorkoutsByRange.all(req.user.id, monthAgo, now);
  const muscleMap = {};
  monthLogs.forEach(l => {
    const mg = l.muscle_group || 'Other';
    muscleMap[mg] = (muscleMap[mg] || 0) + 1;
  });
  const muscleDistribution = Object.entries(muscleMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const topMuscle = muscleDistribution[0]?.name || null;

  // 4. Volume Trend (last 30 days)
  const volumeHistory = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date((now - i * 86400) * 1000);
    const dateStr = isoDate(d);
    const dayLogs = monthLogs.filter(l => isoDate(new Date(l.logged_at * 1000)) === dateStr);
    let dayVolume = 0;
    dayLogs.forEach(l => {
      const sets = safeParse(l.sets_json);
      sets.forEach(s => {
        dayVolume += (Number(s.reps) || 0) * (Number(s.weight) || 0);
      });
    });
    volumeHistory.push({ date: dateStr, volume: dayVolume });
  }

  // 5. Streak & PRs
  const allDates = stmts.getAllWorkoutDates.all(req.user.id).map(r => r.d);
  const { streak, bestStreak } = calcStreak(allDates);
  const allLogs = stmts.getAllExercisePRs.all(req.user.id);
  const prs = calcPRs(allLogs);

  // 6. Suggestions
  const suggestions = buildSuggestions({
    weekTotal, streak, bestStreak, topMuscle, allDates, allLogs, prs
  });

  res.json({
    ok: true,
    stats: {
      weekTotal,
      lastWeekTotal,
      trendPercent,
      streak,
      bestStreak,
      topMuscle,
      weeklyActivity,
      muscleDistribution,
      volumeHistory,
      prs,
      suggestions
    }
  });
}));

/* ---------- DELETE /api/tracker/:id ---------- */
trackerRoutes.delete('/:id', handler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) throw new ApiError(400, 'Invalid workout ID.');

  const existing = stmts.getWorkoutById.get(id, req.user.id);
  if (!existing) throw new ApiError(404, 'Workout not found.');

  stmts.deleteWorkout.run(id, req.user.id);
  res.json({ ok: true });
}));

/* ---------- helpers ---------- */

function safeParse(json) {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

function calcStreak(dates) {
  // dates = ['2026-04-28', '2026-04-27', ...] already sorted DESC
  if (!dates.length) return { streak: 0, bestStreak: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = isoDate(today);

  let streak = 0;
  let bestStreak = 0;
  let currentRun = 0;

  // Walk through all dates for best streak
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      const diffDays = (prev - curr) / 86400000;
      if (diffDays === 1) {
        currentRun++;
      } else {
        bestStreak = Math.max(bestStreak, currentRun);
        currentRun = 1;
      }
    }
  }
  bestStreak = Math.max(bestStreak, currentRun);

  // Current streak: must include today or yesterday
  const yesterdayStr = isoDate(new Date(today.getTime() - 86400000));
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    streak = 0;
  } else {
    streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      if ((prev - curr) / 86400000 === 1) {
        streak++;
      } else {
        break;
      }
    }
  }

  return { streak, bestStreak };
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcPRs(logs) {
  const best = {};
  for (const log of logs) {
    const sets = safeParse(log.sets_json);
    for (const s of sets) {
      const w = Number(s.weight) || 0;
      if (w > 0 && (!best[log.exercise] || w > best[log.exercise].weight)) {
        const wid = Number(log.id);
        const entry = {
          weight: w,
          reps: s.reps,
          date: log.logged_at,
          workoutLogId: Number.isFinite(wid) ? wid : undefined,
          workoutId: Number.isFinite(wid) ? wid : undefined,
        };
        best[log.exercise] = entry;
      }
    }
  }
  return Object.entries(best)
    .map(([exercise, data]) => ({ exercise, ...data }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function buildSuggestions({ weekTotal, streak, bestStreak, allDates, allLogs, prs }) {
  const suggestions = [];

  // Streak nudge
  if (streak > 0 && streak === bestStreak - 1) {
    suggestions.push({ type: 'streak', text: `🔥 You're 1 workout away from your best streak of ${bestStreak} days!` });
  } else if (streak >= 3) {
    suggestions.push({ type: 'streak', text: `🔥 ${streak}-day streak! Keep the momentum going.` });
  } else if (streak === 0 && bestStreak > 0) {
    suggestions.push({ type: 'streak', text: `💪 Start a new streak today! Your best was ${bestStreak} days.` });
  }

  // Day-of-week pattern
  if (allLogs.length >= 5) {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const log of allLogs) {
      const d = new Date(log.logged_at * 1000);
      dayCounts[d.getDay()]++;
    }
    const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
    const today = new Date().getDay();
    if (maxDay === today && dayCounts[maxDay] >= 3) {
      suggestions.push({ type: 'pattern', text: `📅 You usually train on ${dayNames[maxDay]}s — perfect day for a session!` });
    }
  }

  // Weight progression
  if (prs.length > 0) {
    const topPR = prs[0];
    suggestions.push({
      type: 'progress',
      text: `📈 Try ${topPR.exercise} at ${topPR.weight + 2.5}kg — just +2.5kg from your PR!`
    });
  }

  // Encouragement for low activity
  if (weekTotal === 0) {
    suggestions.push({ type: 'motivate', text: `🏋️ No workouts logged this week yet. Start with something small!` });
  } else if (weekTotal >= 5) {
    suggestions.push({ type: 'motivate', text: `⭐ ${weekTotal} workouts this week — you're on fire!` });
  }

  return suggestions.slice(0, 3);
}
