/*
 * SpotMe — SQLite database layer (sql.js / WASM flavor)
 * ------------------------------------------------------------
 * We use sql.js (pure-WebAssembly SQLite) instead of native
 * better-sqlite3. Trade-offs:
 *   + No compilation step, installs with plain `npm install` on
 *     every OS (Windows, macOS, Linux) without Python/build-tools
 *   + Single small dependency
 *   − sql.js lives in memory, so after each write we serialize
 *     the DB back to a single file (`spotme.sqlite`) on disk
 *
 * The `stmts` object emulates the shape the routes expect:
 *   stmts.foo.get(...args)  → one row object or undefined
 *   stmts.foo.all(...args)  → array of rows
 *   stmts.foo.run(...args)  → { changes, lastInsertRowid }
 * ------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'spotme.sqlite');

const SQL = await initSqlJs();

// Load existing DB file if present, else create a fresh in-memory one.
let sqlDb;
if (fs.existsSync(dbPath)) {
  sqlDb = new SQL.Database(fs.readFileSync(dbPath));
} else {
  sqlDb = new SQL.Database();
}

/* ---------- schema ---------- */
sqlDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash   TEXT    NOT NULL,
    first_name      TEXT    NOT NULL,
    last_name       TEXT    NOT NULL,
    country_code    TEXT,
    phone           TEXT,
    level           TEXT,
    weight          REAL,
    weight_unit     TEXT,
    height          REAL,
    height_unit     TEXT,
    plays_sport     TEXT,
    sport_name      TEXT,
    training_goal   TEXT,
    plan            TEXT    NOT NULL DEFAULT 'free',
    avatar_url      TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    token           TEXT    PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at      INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens(user_id);

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    title           TEXT    NOT NULL DEFAULT 'New conversation',
    tags            TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON chat_sessions(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    image_data_url  TEXT,
    structured_json TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS workout_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    exercise      TEXT    NOT NULL,
    sets_json     TEXT    NOT NULL DEFAULT '[]',
    muscle_group  TEXT,
    machine_id    TEXT,
    source        TEXT    NOT NULL DEFAULT 'manual',
    logged_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS workout_logs_user_date_idx ON workout_logs(user_id, logged_at DESC);

  CREATE TABLE IF NOT EXISTS programs (
    id              TEXT PRIMARY KEY,
    category        TEXT NOT NULL,
    name            TEXT NOT NULL,
    difficulty      TEXT,
    cover_color     TEXT,
    cover_image     TEXT,
    hero_image      TEXT,
    total_minutes   INTEGER,
    total_calories  INTEGER,
    description     TEXT
  );

  CREATE TABLE IF NOT EXISTS program_sessions (
    id              TEXT PRIMARY KEY,
    program_id      TEXT NOT NULL,
    ord             INTEGER NOT NULL,
    name            TEXT NOT NULL,
    sets            INTEGER,
    reps            INTEGER,
    minutes         INTEGER,
    thumbnail       TEXT,
    tips            TEXT,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS program_sessions_program_idx ON program_sessions(program_id, ord);

  CREATE TABLE IF NOT EXISTS user_program_runs (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL,
    program_id         TEXT NOT NULL,
    session_id         TEXT,
    started_at         INTEGER NOT NULL DEFAULT (unixepoch()),
    finished_at        INTEGER,
    calories           INTEGER,
    duration_seconds   INTEGER,
    avg_bpm            INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS user_program_runs_user_idx ON user_program_runs(user_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS daily_metrics (
    user_id        INTEGER NOT NULL,
    day            TEXT    NOT NULL,
    steps          INTEGER DEFAULT 0,
    water_liters   REAL    DEFAULT 0,
    calories       INTEGER DEFAULT 0,
    resting_bpm    INTEGER,
    PRIMARY KEY (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

/* ---------- migrations ---------- */
try { sqlDb.exec(`ALTER TABLE program_sessions ADD COLUMN tips TEXT`); } catch {}

/* ---------- persistence ---------- */

let writeScheduled = false;
function persist() {
  if (writeScheduled) return;
  writeScheduled = true;
  setImmediate(() => {
    writeScheduled = false;
    try {
      fs.writeFileSync(dbPath, Buffer.from(sqlDb.export()));
    } catch (e) {
      console.error('[spotme] Failed to persist DB:', e.message);
    }
  });
}
setInterval(persist, 10_000);
process.on('beforeExit', persist);
process.on('SIGINT',  () => { persist(); process.exit(0); });
process.on('SIGTERM', () => { persist(); process.exit(0); });

/* ---------- prepared-statement wrapper ----------
 * Accepts SQL with either positional `?` params or named `@foo` params.
 * When named params are used, callers pass a single object; the
 * wrapper translates it to positional binds before handing to sql.js.
 */
function prep(sql) {
  const namedParams = [...sql.matchAll(/@(\w+)\b/g)].map(m => m[1]);
  const normalizedSql = namedParams.length ? sql.replace(/@\w+/g, '?') : sql;

  function bindArgs(args) {
    if (namedParams.length && args.length === 1 && args[0] !== null &&
        typeof args[0] === 'object' && !Array.isArray(args[0])) {
      return namedParams.map(n => args[0][n] === undefined ? null : args[0][n]);
    }
    return args;
  }

  return {
    get(...args) {
      const stmt = sqlDb.prepare(normalizedSql);
      try {
        stmt.bind(bindArgs(args));
        return stmt.step() ? stmt.getAsObject() : undefined;
      } finally { stmt.free(); }
    },
    all(...args) {
      const stmt = sqlDb.prepare(normalizedSql);
      const rows = [];
      try {
        stmt.bind(bindArgs(args));
        while (stmt.step()) rows.push(stmt.getAsObject());
      } finally { stmt.free(); }
      return rows;
    },
    run(...args) {
      sqlDb.run(normalizedSql, bindArgs(args));
      const changes = sqlDb.getRowsModified();
      const res = sqlDb.exec('SELECT last_insert_rowid() AS id');
      const lastInsertRowid = res?.[0]?.values?.[0]?.[0] ?? 0;
      persist();
      return { changes, lastInsertRowid };
    }
  };
}

/* ---------- prepared statements ---------- */

export const stmts = {
  getUserByEmail:     prep('SELECT * FROM users WHERE email = ?'),
  getUserById:        prep('SELECT * FROM users WHERE id = ?'),
  insertUser:         prep(`
    INSERT INTO users (
      email, password_hash, first_name, last_name, country_code, phone,
      level, weight, weight_unit, height, height_unit,
      plays_sport, sport_name, training_goal
    ) VALUES (
      @email, @password_hash, @first_name, @last_name, @country_code, @phone,
      @level, @weight, @weight_unit, @height, @height_unit,
      @plays_sport, @sport_name, @training_goal
    )
  `),
  updateUserProfile:  prep(`
    UPDATE users SET
      first_name  = @first_name,
      last_name   = @last_name,
      weight      = @weight,
      weight_unit = @weight_unit,
      height      = @height,
      height_unit = @height_unit,
      level       = @level,
      avatar_url  = @avatar_url,
      updated_at  = unixepoch()
    WHERE id = @id
  `),

  insertToken:        prep('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'),
  getToken:           prep('SELECT * FROM auth_tokens WHERE token = ?'),
  deleteToken:        prep('DELETE FROM auth_tokens WHERE token = ?'),
  cleanExpiredTokens: prep('DELETE FROM auth_tokens WHERE expires_at < unixepoch()'),

  createSession:      prep('INSERT INTO chat_sessions (user_id, title, tags) VALUES (?, ?, ?)'),
  listSessions:       prep('SELECT cs.id, cs.title, cs.tags, cs.created_at, cs.updated_at, (SELECT content FROM messages WHERE session_id = cs.id AND role = \'user\' ORDER BY id ASC LIMIT 1) as preview FROM chat_sessions cs WHERE cs.user_id = ? ORDER BY cs.updated_at DESC'),
  getSession:         prep('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?'),
  updateSessionMeta:  prep('UPDATE chat_sessions SET title = ?, tags = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?'),
  touchSession:       prep('UPDATE chat_sessions SET updated_at = unixepoch() WHERE id = ?'),
  deleteSession:      prep('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?'),

  insertMessage:      prep(`
    INSERT INTO messages (session_id, role, content, image_data_url, structured_json)
    VALUES (@session_id, @role, @content, @image_data_url, @structured_json)
  `),
  listMessages:       prep('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC'),

  /* ---- tracker ---- */
  insertWorkout:      prep(`
    INSERT INTO workout_logs (user_id, exercise, sets_json, muscle_group, machine_id, source, logged_at)
    VALUES (@user_id, @exercise, @sets_json, @muscle_group, @machine_id, @source, @logged_at)
  `),
  getWorkoutsByRange: prep(`
    SELECT * FROM workout_logs
    WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
    ORDER BY logged_at DESC, id DESC
  `),
  getRecentExercises: prep(`
    SELECT exercise, sets_json, muscle_group,
           MAX(logged_at) as last_used
    FROM workout_logs
    WHERE user_id = ?
    GROUP BY exercise
    ORDER BY last_used DESC
    LIMIT 15
  `),
  getWorkoutCount:    prep(`
    SELECT COUNT(*) as cnt FROM workout_logs
    WHERE user_id = ? AND logged_at >= ?
  `),
  getTopMuscle:       prep(`
    SELECT muscle_group, COUNT(*) as cnt
    FROM workout_logs
    WHERE user_id = ? AND logged_at >= ? AND muscle_group IS NOT NULL AND muscle_group != ''
    GROUP BY muscle_group
    ORDER BY cnt DESC
    LIMIT 1
  `),
  getAllWorkoutDates:  prep(`
    SELECT DISTINCT date(logged_at, 'unixepoch') as d
    FROM workout_logs
    WHERE user_id = ?
    ORDER BY d DESC
  `),
  getAllExercisePRs:   prep(`
    SELECT exercise, sets_json, logged_at
    FROM workout_logs
    WHERE user_id = ?
    ORDER BY logged_at DESC
  `),
  getWorkoutById:     prep('SELECT * FROM workout_logs WHERE id = ? AND user_id = ?'),
  deleteWorkout:      prep('DELETE FROM workout_logs WHERE id = ? AND user_id = ?'),

  /* ---- programs catalogue ---- */
  listPrograms:       prep('SELECT * FROM programs ORDER BY category, name'),
  listProgramsByCat:  prep('SELECT * FROM programs WHERE category = ? ORDER BY name'),
  getProgram:         prep('SELECT * FROM programs WHERE id = ?'),
  insertProgram:      prep(`
    INSERT OR REPLACE INTO programs (
      id, category, name, difficulty, cover_color, cover_image, hero_image,
      total_minutes, total_calories, description
    ) VALUES (
      @id, @category, @name, @difficulty, @cover_color, @cover_image, @hero_image,
      @total_minutes, @total_calories, @description
    )
  `),
  listProgramSessions: prep('SELECT * FROM program_sessions WHERE program_id = ? ORDER BY ord ASC'),
  insertProgramSession: prep(`
    INSERT OR REPLACE INTO program_sessions (
      id, program_id, ord, name, sets, reps, minutes, thumbnail, tips
    ) VALUES (
      @id, @program_id, @ord, @name, @sets, @reps, @minutes, @thumbnail, @tips
    )
  `),

  /* ---- user program runs ---- */
  insertProgramRun:   prep(`
    INSERT INTO user_program_runs (user_id, program_id, session_id)
    VALUES (?, ?, ?)
  `),
  finishProgramRun:   prep(`
    UPDATE user_program_runs
    SET finished_at = unixepoch(),
        calories = ?,
        duration_seconds = ?,
        avg_bpm = ?
    WHERE id = ? AND user_id = ?
  `),
  getProgramRun:      prep('SELECT * FROM user_program_runs WHERE id = ? AND user_id = ?'),
  listRecentRuns:     prep(`
    SELECT * FROM user_program_runs
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `),

  /* ---- daily metrics ---- */
  upsertDailyMetric:  prep(`
    INSERT INTO daily_metrics (user_id, day, steps, water_liters, calories, resting_bpm)
    VALUES (@user_id, @day, @steps, @water_liters, @calories, @resting_bpm)
    ON CONFLICT(user_id, day) DO UPDATE SET
      steps        = COALESCE(excluded.steps,        daily_metrics.steps),
      water_liters = COALESCE(excluded.water_liters, daily_metrics.water_liters),
      calories     = COALESCE(excluded.calories,     daily_metrics.calories),
      resting_bpm  = COALESCE(excluded.resting_bpm,  daily_metrics.resting_bpm)
  `),
  getDailyMetric:     prep('SELECT * FROM daily_metrics WHERE user_id = ? AND day = ?'),
  listDailyMetrics:   prep(`
    SELECT * FROM daily_metrics
    WHERE user_id = ? AND day >= ?
    ORDER BY day DESC
  `),

  deleteUser:         prep('DELETE FROM users WHERE id = ?')
};

/* ---------- seed: programs catalogue ---------- */

function seedPrograms() {
  const existing = sqlDb.exec('SELECT COUNT(*) as cnt FROM programs');
  const count = existing?.[0]?.values?.[0]?.[0] ?? 0;
  if (count > 0) return;

  const PROGRAMS = [
    {
      id: 'upper-pro', category: 'muscle', name: 'Upper',
      difficulty: 'Professional', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 25, total_calories: 1200,
      description: 'Build upper body strength — chest, shoulders, back, arms.'
    },
    {
      id: 'yoga-beginner', category: 'cardio', name: 'Yoga',
      difficulty: 'Beginner', cover_color: 'lime',
      cover_image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 25, total_calories: 1200,
      description: 'Calm, balanced movement to start or unwind your day.'
    },
    {
      id: 'cycling-intermediate', category: 'cardio', name: 'Cycling',
      difficulty: 'Intermediate', cover_color: 'orange',
      cover_image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 35, total_calories: 1500,
      description: 'High-intensity cardio cycling for cardiovascular endurance.'
    },
    {
      id: 'lower-pro', category: 'muscle', name: 'Lower',
      difficulty: 'Professional', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 30, total_calories: 1100,
      description: 'Quads, hamstrings, glutes, calves — full lower body builder.'
    },
    {
      id: 'core-beginner', category: 'muscle', name: 'Core',
      difficulty: 'Beginner', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 15, total_calories: 600,
      description: 'Strengthen your trunk with focused, low-impact moves.'
    },
    {
      id: 'diet-macro', category: 'diet', name: 'Macro Plan',
      difficulty: 'All levels', cover_color: 'lime',
      cover_image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 7, total_calories: 0,
      description: 'A 7-day balanced macro guide — protein targets, smart carb timing, healthy fats, and practical meal-prep tips tuned to your goals.'
    }
  ];

  const SESSIONS = {
    'upper-pro':            [
      { name: 'Upper',  sets: 1, reps: 4, minutes: 12, thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60' },
      { name: 'Lower',  sets: 1, reps: 4, minutes: 13, thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60' }
    ],
    'yoga-beginner':        [
      { name: 'Lower',  sets: 1, reps: 4, minutes: 12, thumbnail: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=200&q=60' },
      { name: 'Upper',  sets: 1, reps: 4, minutes: 13, thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=200&q=60' }
    ],
    'cycling-intermediate': [
      { name: 'Warm-up', sets: 1, reps: 1, minutes: 5,  thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=60' },
      { name: 'Sprint',  sets: 5, reps: 1, minutes: 20, thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=60' },
      { name: 'Cooldown', sets: 1, reps: 1, minutes: 10, thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=60' }
    ],
    'lower-pro': [
      { name: 'Squats',  sets: 4, reps: 8, minutes: 15, thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60' },
      { name: 'Lunges',  sets: 3, reps: 12, minutes: 15, thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60' }
    ],
    'core-beginner': [
      { name: 'Planks',  sets: 3, reps: 1, minutes: 5, thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60' },
      { name: 'Crunches', sets: 3, reps: 15, minutes: 10, thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60' }
    ],
    'diet-macro': [
      {
        name: 'Day 1 — Set Your Baseline',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
        tips: 'Today is about understanding your numbers.\n\n• Protein: aim for 1.6–2.2 g per kg of bodyweight. This is the single most important macro — it preserves muscle, keeps you full, and boosts metabolism.\n• Carbs: 3–5 g/kg on training days, ~20% less on rest days.\n• Fats: 0.8–1.2 g/kg. Never drop below 0.6 g/kg — fats regulate hormones.\n\nLog everything you eat today without changing anything. Awareness is the first step. Use a food scale if you have one — most people underestimate portions by 30–40%.'
      },
      {
        name: 'Day 2 — Protein-First Breakfasts',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
        tips: 'Start every morning with 30–40 g of protein. This sets your appetite hormones for the rest of the day and reduces evening cravings by up to 60%.\n\nHigh-protein breakfast ideas:\n• 3 whole eggs + 2 egg whites scrambled with spinach and feta (32 g protein)\n• Greek yogurt (200 g) + mixed berries + 30 g granola (28 g protein)\n• Protein smoothie: 1 scoop whey, 1 banana, 200 ml oat milk, 1 tbsp peanut butter (34 g protein)\n• Cottage cheese (150 g) on whole-grain toast with sliced tomato (25 g protein)\n\nAim for your breakfast to cover at least 25% of your daily protein target.'
      },
      {
        name: 'Day 3 — Carb Timing',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
        tips: 'Carbs are not the enemy — poor timing is.\n\nPre-workout (1–2 hours before): eat complex carbs — oats, sweet potato, brown rice, or whole-grain bread. These give you sustained energy without a crash.\n\nPost-workout (within 45 minutes): combine fast-digesting carbs with protein. A banana + protein shake, or rice + chicken, accelerates muscle recovery.\n\nRest days: reduce total carbs by ~20% and replace those calories with healthy fats (avocado, nuts, olive oil). Your body does not need as much glucose when it is not training.\n\nToday, try to time at least one carb-rich meal around a workout or a walk.'
      },
      {
        name: 'Day 4 — Healthy Fats & Hormones',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=200&q=60',
        tips: 'Dietary fat is essential — it produces testosterone, oestrogen, and cortisol, all of which directly affect body composition.\n\nBest fat sources:\n• Avocado (1/2 = ~15 g fat, mostly monounsaturated)\n• Extra-virgin olive oil (1 tbsp = 14 g fat, rich in oleic acid)\n• Fatty fish — salmon, mackerel, sardines (Omega-3s reduce inflammation)\n• Mixed nuts — almonds, walnuts, cashews (but watch portions: 30 g = ~180 kcal)\n• Eggs — the yolk contains fat-soluble vitamins A, D, E, K\n\nKeep saturated fat under 10% of total calories. Eliminate trans fats entirely (found in processed pastries and fried fast food).\n\nToday, swap any processed snack for a small handful of nuts or half an avocado.'
      },
      {
        name: 'Day 5 — Hydration & Sodium',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=200&q=60',
        tips: 'Water is an underrated fat-loss tool. Even mild dehydration (1–2%) impairs metabolism by up to 3% and mimics hunger.\n\nTarget: 35 ml per kg of bodyweight per day. Add 500 ml for every hour of exercise.\n\nSodium tips:\n• Processed and packaged foods are the biggest sodium culprits — one serving of soup can contain 900 mg (40% of daily limit).\n• High sodium causes water retention that can mask a week of fat loss on the scale.\n• Season with herbs, lemon, garlic, and spices instead of extra salt.\n• If you ate high-sodium yesterday, drink an extra litre of water today to flush it.\n\nToday\'s challenge: drink a glass of water before each meal. It naturally reduces portion sizes by ~13%.'
      },
      {
        name: 'Day 6 — Meal Prep Sunday',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=200&q=60',
        tips: 'Meal prep is the single habit that separates people who consistently hit their macros from those who do not. Remove the decision — remove the failure.\n\n90-minute prep routine:\n1. Cook a large batch of protein: 800–1000 g chicken breast, or a mix of eggs, lentils, and tuna for variety.\n2. Cook a bulk carb: 400 g dry weight of rice, quinoa, or sweet potato.\n3. Roast 3–4 vegetables on one tray: broccoli, peppers, courgette, onion (olive oil + seasoning, 200 °C, 25 min).\n4. Portion into containers: 4–5 days of lunches/dinners in under 10 minutes.\n\nWith prepped food in the fridge, you are never more than 2 minutes away from a macro-balanced meal. This eliminates the grab-something-quick decisions that derail most diets.'
      },
      {
        name: 'Day 7 — Refeed & Review',
        sets: 3, reps: null, minutes: null,
        thumbnail: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=60',
        tips: 'Well done on completing your first week.\n\nToday is a structured refeed — eat at or slightly above maintenance calories, with carbs at the higher end and fat slightly lower. This resets leptin (your satiety hormone) and prevents metabolic slowdown from sustained calorie restriction.\n\nWeekly review checklist:\n✓ Did you hit your protein target on 5+ days?\n✓ Did you drink enough water on most days?\n✓ Did you time carbs around activity?\n✓ Did you prep at least some meals in advance?\n\nNext steps: if fat loss is your goal, stick to a 300–500 kcal daily deficit — any larger and you risk muscle loss. Adjust your targets every 2 weeks as your bodyweight changes. Consistency over 4–6 weeks will reveal real trends; day-to-day scale fluctuations are mostly water.'
      }
    ]
  };

  for (const p of PROGRAMS) {
    stmts.insertProgram.run(p);
    const sessions = SESSIONS[p.id] || [];
    sessions.forEach((s, i) => {
      stmts.insertProgramSession.run({
        id: `${p.id}-s${i + 1}`,
        program_id: p.id,
        ord: i + 1,
        name: s.name,
        sets: s.sets ?? null,
        reps: s.reps ?? null,
        minutes: s.minutes ?? null,
        thumbnail: s.thumbnail ?? null,
        tips: s.tips ?? null
      });
    });
  }
}
seedPrograms();

/* ---------- patch: keep diet-macro sessions up to date ----------
   Runs on every boot so content changes are applied to existing DBs. */
function patchDietMacro() {
  const DIET_SESSIONS = [
    {
      id: 'diet-macro-s1',
      name: 'Day 1 — Set Your Baseline',
      ord: 1, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Today is about understanding your numbers.\n\n• Protein: aim for 1.6–2.2 g per kg of bodyweight. This is the single most important macro — it preserves muscle, keeps you full, and boosts metabolism.\n• Carbs: 3–5 g/kg on training days, ~20% less on rest days.\n• Fats: 0.8–1.2 g/kg. Never drop below 0.6 g/kg — fats regulate hormones.\n\nLog everything you eat today without changing anything. Awareness is the first step. Use a food scale if you have one — most people underestimate portions by 30–40%.'
    },
    {
      id: 'diet-macro-s2',
      name: 'Day 2 — Protein-First Breakfasts',
      ord: 2, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Start every morning with 30–40 g of protein. This sets your appetite hormones for the rest of the day and reduces evening cravings by up to 60%.\n\nHigh-protein breakfast ideas:\n• 3 whole eggs + 2 egg whites scrambled with spinach and feta (32 g protein)\n• Greek yogurt (200 g) + mixed berries + 30 g granola (28 g protein)\n• Protein smoothie: 1 scoop whey, 1 banana, 200 ml oat milk, 1 tbsp peanut butter (34 g protein)\n• Cottage cheese (150 g) on whole-grain toast with sliced tomato (25 g protein)\n\nAim for your breakfast to cover at least 25% of your daily protein target.'
    },
    {
      id: 'diet-macro-s3',
      name: 'Day 3 — Carb Timing',
      ord: 3, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Carbs are not the enemy — poor timing is.\n\nPre-workout (1–2 hours before): eat complex carbs — oats, sweet potato, brown rice, or whole-grain bread. These give you sustained energy without a crash.\n\nPost-workout (within 45 minutes): combine fast-digesting carbs with protein. A banana + protein shake, or rice + chicken, accelerates muscle recovery.\n\nRest days: reduce total carbs by ~20% and replace those calories with healthy fats (avocado, nuts, olive oil). Your body does not need as much glucose when it is not training.\n\nToday, try to time at least one carb-rich meal around a workout or a walk.'
    },
    {
      id: 'diet-macro-s4',
      name: 'Day 4 — Healthy Fats & Hormones',
      ord: 4, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=200&q=60',
      tips: 'Dietary fat is essential — it produces testosterone, oestrogen, and cortisol, all of which directly affect body composition.\n\nBest fat sources:\n• Avocado (1/2 = ~15 g fat, mostly monounsaturated)\n• Extra-virgin olive oil (1 tbsp = 14 g fat, rich in oleic acid)\n• Fatty fish — salmon, mackerel, sardines (Omega-3s reduce inflammation)\n• Mixed nuts — almonds, walnuts, cashews (but watch portions: 30 g = ~180 kcal)\n• Eggs — the yolk contains fat-soluble vitamins A, D, E, K\n\nKeep saturated fat under 10% of total calories. Eliminate trans fats entirely (found in processed pastries and fried fast food).\n\nToday, swap any processed snack for a small handful of nuts or half an avocado.'
    },
    {
      id: 'diet-macro-s5',
      name: 'Day 5 — Hydration & Sodium',
      ord: 5, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=200&q=60',
      tips: 'Water is an underrated fat-loss tool. Even mild dehydration (1–2%) impairs metabolism by up to 3% and mimics hunger.\n\nTarget: 35 ml per kg of bodyweight per day. Add 500 ml for every hour of exercise.\n\nSodium tips:\n• Processed and packaged foods are the biggest sodium culprits — one serving of soup can contain 900 mg (40% of daily limit).\n• High sodium causes water retention that can mask a week of fat loss on the scale.\n• Season with herbs, lemon, garlic, and spices instead of extra salt.\n• If you ate high-sodium yesterday, drink an extra litre of water today to flush it.\n\nToday\'s challenge: drink a glass of water before each meal. It naturally reduces portion sizes by ~13%.'
    },
    {
      id: 'diet-macro-s6',
      name: 'Day 6 — Meal Prep Sunday',
      ord: 6, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=200&q=60',
      tips: 'Meal prep is the single habit that separates people who consistently hit their macros from those who do not. Remove the decision — remove the failure.\n\n90-minute prep routine:\n1. Cook a large batch of protein: 800–1000 g chicken breast, or a mix of eggs, lentils, and tuna for variety.\n2. Cook a bulk carb: 400 g dry weight of rice, quinoa, or sweet potato.\n3. Roast 3–4 vegetables on one tray: broccoli, peppers, courgette, onion (olive oil + seasoning, 200 °C, 25 min).\n4. Portion into containers: 4–5 days of lunches/dinners in under 10 minutes.\n\nWith prepped food in the fridge, you are never more than 2 minutes away from a macro-balanced meal. This eliminates the "I\'ll just grab something quick" decisions that derail most diets.'
    },
    {
      id: 'diet-macro-s7',
      name: 'Day 7 — Refeed & Review',
      ord: 7, sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=60',
      tips: 'Well done on completing your first week.\n\nToday is a structured refeed — eat at or slightly above maintenance calories, with carbs at the higher end and fat slightly lower. This resets leptin (your satiety hormone) and prevents metabolic slowdown from sustained calorie restriction.\n\nWeekly review checklist:\n✓ Did you hit your protein target on 5+ days?\n✓ Did you drink enough water on most days?\n✓ Did you time carbs around activity?\n✓ Did you prep at least some meals in advance?\n\nNext steps: if fat loss is your goal, stick to a 300–500 kcal daily deficit — any larger and you risk muscle loss. Adjust your targets every 2 weeks as your bodyweight changes. Consistency over 4–6 weeks will reveal real trends; day-to-day scale fluctuations are mostly water.'
    }
  ];

  sqlDb.exec(`
    UPDATE programs
    SET description = 'A 7-day balanced macro guide — protein targets, smart carb timing, healthy fats, and practical meal-prep tips tuned to your goals.'
    WHERE id = 'diet-macro'
  `);

  sqlDb.exec(`DELETE FROM program_sessions WHERE program_id = 'diet-macro'`);

  for (const s of DIET_SESSIONS) {
    stmts.insertProgramSession.run({
      id: s.id,
      program_id: 'diet-macro',
      ord: s.ord,
      name: s.name,
      sets: s.sets,
      reps: s.reps,
      minutes: s.minutes,
      thumbnail: s.thumbnail,
      tips: s.tips
    });
  }
  persist();
}
patchDietMacro();

stmts.cleanExpiredTokens.run();
setInterval(() => stmts.cleanExpiredTokens.run(), 60 * 60 * 1000);

export const db = { open: true, persist };
