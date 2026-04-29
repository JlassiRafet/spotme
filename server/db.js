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
[
  'ALTER TABLE users ADD COLUMN stripe_customer_id TEXT',
  'ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT',
  'ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT \'free\'',
  'ALTER TABLE users ADD COLUMN subscription_end INTEGER',
].forEach(sql => { try { sqlDb.exec(sql); } catch {} });
try { sqlDb.exec(`ALTER TABLE program_sessions ADD COLUMN tips TEXT`); } catch {}
/* colour migrations — idempotent */
sqlDb.exec(`UPDATE programs SET cover_color = 'purple' WHERE name = 'Upper'`);
sqlDb.exec(`UPDATE programs SET cover_color = 'pink'   WHERE name = 'Lower'`);
sqlDb.exec(`UPDATE programs SET cover_color = 'purple' WHERE name = 'Macro Plan'`);
sqlDb.exec(`UPDATE programs SET cover_color = 'pink'   WHERE name = 'Mediterranean Diet'`);

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
    SELECT id, exercise, sets_json, logged_at
    FROM workout_logs
    WHERE user_id = ?
    ORDER BY logged_at DESC
  `),
  getWorkoutById:     prep('SELECT * FROM workout_logs WHERE id = ? AND user_id = ?'),
  deleteWorkout:      prep('DELETE FROM workout_logs WHERE id = ? AND user_id = ?'),

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

  /* ---- subscription / pro plan ---- */
  updateSubscription: prep(`
    UPDATE users SET
      plan                   = @plan,
      stripe_customer_id     = @stripe_customer_id,
      stripe_subscription_id = @stripe_subscription_id,
      subscription_status    = @subscription_status,
      subscription_end       = @subscription_end,
      updated_at             = unixepoch()
    WHERE id = @id
  `),
  getUserByStripeCustomer: prep('SELECT * FROM users WHERE stripe_customer_id = ?'),
  getUserByStripeSubscription: prep('SELECT * FROM users WHERE stripe_subscription_id = ?'),

  /* daily message count for free-tier limiting */
  countUserMessagesToday: prep(`
    SELECT COUNT(*) as cnt
    FROM messages m
    JOIN chat_sessions cs ON cs.id = m.session_id
    WHERE cs.user_id = ? AND m.role = 'user' AND m.created_at >= ?
  `),

  /* limited session listing for free users */
  listSessionsLimited: prep(`
    SELECT cs.id, cs.title, cs.tags, cs.created_at, cs.updated_at,
           (SELECT content FROM messages WHERE session_id = cs.id AND role = 'user'
            ORDER BY id ASC LIMIT 1) as preview
    FROM chat_sessions cs
    WHERE cs.user_id = ?
    ORDER BY cs.updated_at DESC
    LIMIT ?
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
      id: 'upper-pro', category: 'muscle', name: 'Upper Body',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 30, total_calories: 1200,
      description: 'Chest, shoulders, back and arms — three compound lifts to build balanced upper body strength.'
    },
    {
      id: 'push-day', category: 'muscle', name: 'Push Day',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 38, total_calories: 1400,
      description: 'Chest, shoulders and triceps — compound presses plus isolation work for full push-muscle development.'
    },
    {
      id: 'pull-day', category: 'muscle', name: 'Pull Day',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 38, total_calories: 1300,
      description: 'Back and biceps — pull-ups, rows and curls for width, thickness and arm strength.'
    },
    {
      id: 'leg-day', category: 'muscle', name: 'Leg Day',
      difficulty: 'Intermediate', cover_color: 'lime',
      cover_image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=800&q=80',
      hero_image:  'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=80',
      total_minutes: 43, total_calories: 1600,
      description: 'Quads, hamstrings, glutes and calves — squat-based lower body programme for size and strength.'
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
      id: 'lower-pro', category: 'muscle', name: 'Lower Body',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1583454155184-870a1f63aebc?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 42, total_calories: 1200,
      description: 'Quads, hamstrings, glutes, calves — a realistic full lower body training session with strength and muscle-building focus.'
    },
    {
      id: 'core-beginner', category: 'muscle', name: 'Core',
      difficulty: 'Beginner', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=800&q=80',
      hero_image:  'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=80',
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
    'upper-pro': [
      { name: 'Bench Press', sets: 4, reps: 10, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: chest, shoulders, triceps\nLie flat, bar over mid-chest. Lower to touch, press up explosively. Keep shoulder blades pinched together throughout.' },
      { name: 'Overhead Press', sets: 3, reps: 10, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders, triceps\nStart at shoulder height. Press bar overhead until arms locked out. Keep core braced, avoid flaring elbows.' },
      { name: 'Bent-Over Row', sets: 4, reps: 10, minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, upper-back, biceps\nHinge at hips, back flat. Pull bar to lower sternum, squeeze shoulder blades at top. Lower with control.' }
    ],
    'push-day': [
      { name: 'Bench Press', sets: 4, reps: 10, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: chest, shoulders, triceps\nLie flat, bar over mid-chest. Lower to touch, press up explosively. Keep shoulder blades pinched together throughout.' },
      { name: 'Overhead Press', sets: 3, reps: 10, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders, triceps\nStart at shoulder height. Press overhead until locked out. Brace core, avoid arching the lower back.' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 12, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: chest, shoulders\nBench at 30–45°. Press dumbbells up and slightly together. Stretch at the bottom, squeeze at the top.' },
      { name: 'Lateral Raises', sets: 3, reps: 15, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders\nLight dumbbells, slight elbow bend. Raise to shoulder height only. Pause at top — the lowering phase builds the muscle.' },
      { name: 'Tricep Pushdown', sets: 3, reps: 12, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: triceps\nElbows pinned to sides. Push bar or rope down until arms fully extend. Squeeze hard at the bottom, return with control.' }
    ],
    'pull-day': [
      { name: 'Pull-ups', sets: 3, reps: 8, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, biceps\nHang, shoulder-width grip. Drive elbows down to pull chest to bar. Full hang at bottom, chin over bar at top.' },
      { name: 'Barbell Row', sets: 4, reps: 8, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, upper-back, biceps\nHinge at hips, back flat. Pull bar to lower sternum, elbows 45° from body. Squeeze shoulder blades hard at the top.' },
      { name: 'Face Pulls', sets: 3, reps: 15, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: rear-delts, traps\nCable at head height. Pull rope to forehead, elbows flared high. Pause and externally rotate at end range.' },
      { name: 'Lat Pulldown', sets: 3, reps: 10, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, biceps\nWide overhand grip. Lean back slightly, pull bar to upper chest. Initiate with elbows, not hands.' },
      { name: 'Bicep Curls', sets: 3, reps: 12, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: biceps, forearms\nShoulder-width grip, elbows fixed. Curl fully, squeeze at top. Lower slowly — 3-second eccentric for max growth.' }
    ],
    'leg-day': [
      { name: 'Squats', sets: 4, reps: 8, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes\nFeet shoulder-width, bar on upper traps. Descend to parallel or below. Drive through heels, knees track over toes.' },
      { name: 'Romanian Deadlift', sets: 4, reps: 10, minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: hamstrings, glutes, lower-back\nHinge at hips with soft knees. Lower bar along shins until hamstring stretch. Drive hips through to stand.' },
      { name: 'Leg Press', sets: 3, reps: 12, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes\nHigh foot placement targets glutes; low foot placement targets quads. Never lock out knees at the top.' },
      { name: 'Lunges', sets: 3, reps: 12, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes, hamstrings\nStep forward, lower back knee to near-floor. Front shin vertical, weight through front heel. Alternate legs each rep.' },
      { name: 'Calf Raises', sets: 4, reps: 15, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: calves\nStand on step edge, heels hanging off. Rise as high as possible, pause at top. Lower all the way for full stretch. Slow reps for maximum activation.' }
    ],
    'yoga-beginner': [
      { name: 'Sun Salutation', sets: 3, reps: 5, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders, abs, lower-back\nFlow through mountain pose, forward fold, plank, cobra and downward dog. Move with your breath — inhale to extend, exhale to fold.' },
      { name: 'Warrior Sequence', sets: 2, reps: 5, minutes: 13,
        thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes, shoulders\nWarrior I, II and III in sequence. Keep front knee over ankle, hips square. Hold each pose for 5 full breaths before transitioning.' }
    ],
    'cycling-intermediate': [
      { name: 'Warm-up', sets: 1, reps: 1, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, calves\nEasy pace, low resistance. Gradually increase cadence to 80–90 rpm. Get your breathing and legs moving before the main effort.' },
      { name: 'Sprint Intervals', sets: 5, reps: 1, minutes: 20,
        thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, hamstrings, glutes, calves\n30 seconds max effort, 90 seconds easy recovery. 5 rounds total. Push cadence above 100 rpm on sprint efforts.' },
      { name: 'Cooldown', sets: 1, reps: 1, minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, calves\nDrop resistance to near zero. Slow cadence to 60 rpm. Let heart rate come back down gradually over the full 10 minutes.' }
    ],
    'lower-pro': [
      {
        name: 'Barbell Back Squat',
        sets: 4,
        reps: 8,
        minutes: 14,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Keep your chest up, sit back into the hips, and drive through your heels. Breathe in on the descent and power up on the concentric.'
      },
      {
        name: 'Romanian Deadlift',
        sets: 4,
        reps: 10,
        minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Hinge from the hips with a soft knee. Keep the bar close to the legs and feel the stretch in the hamstrings, not the lower back.'
      },
      {
        name: 'Bulgarian Split Squat',
        sets: 3,
        reps: 10,
        minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Keep your front knee tracking over your toes and your torso upright. Use a split stance to load each leg individually for balance and strength.'
      },
      {
        name: 'Hip Thrust',
        sets: 3,
        reps: 12,
        minutes: 6,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Pause and squeeze the glutes at the top of each rep. Keep your chin tucked slightly and your ribs down to isolate the hips.'
      },
      {
        name: 'Standing Calf Raise',
        sets: 3,
        reps: 15,
        minutes: 4,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Use full range of motion: drop the heels down and press all the way up. Pause at the top to feel the contraction.'
      }
    ],
    'core-beginner': [
      { name: 'Plank', sets: 3, reps: 1, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: abs, lower-back\nForearms on ground, body straight from head to heel. Squeeze abs and glutes. Hold for 30–60 seconds per set.' },
      { name: 'Dead Bug', sets: 3, reps: 10, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: abs\nLie on back, arms up, knees at 90°. Slowly lower opposite arm and leg toward floor. Keep lower back pressed into ground throughout.' },
      { name: 'Hollow Hold', sets: 3, reps: 1, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: abs\nLie on back, press lower back into floor. Lift shoulders and legs, arms overhead. Hold the position — this is gymnastics-level core activation.' }
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

function patchLowerProgram() {
  const LOWER_SESSIONS = [
    {
      id: 'lower-pro-s1',
      ord: 1,
      name: 'Barbell Back Squat',
      sets: 4,
      reps: 8,
      minutes: 14,
      thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
      tips: 'Keep your chest up, sit back into the hips, and drive through your heels. Breathe in on the descent and power up on the concentric.'
    },
    {
      id: 'lower-pro-s2',
      ord: 2,
      name: 'Romanian Deadlift',
      sets: 4,
      reps: 10,
      minutes: 10,
      thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
      tips: 'Hinge from the hips with a soft knee. Keep the bar close to the legs and feel the stretch in the hamstrings, not the lower back.'
    },
    {
      id: 'lower-pro-s3',
      ord: 3,
      name: 'Bulgarian Split Squat',
      sets: 3,
      reps: 10,
      minutes: 8,
      thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
      tips: 'Keep your front knee tracking over your toes and your torso upright. Use a split stance to load each leg individually for balance and strength.'
    },
    {
      id: 'lower-pro-s4',
      ord: 4,
      name: 'Hip Thrust',
      sets: 3,
      reps: 12,
      minutes: 6,
      thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
      tips: 'Pause and squeeze the glutes at the top of each rep. Keep your chin tucked slightly and your ribs down to isolate the hips.'
    },
    {
      id: 'lower-pro-s5',
      ord: 5,
      name: 'Standing Calf Raise',
      sets: 3,
      reps: 15,
      minutes: 4,
      thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
      tips: 'Use full range of motion: drop the heels down and press all the way up. Pause at the top to feel the contraction.'
    }
  ];

  sqlDb.exec(`
    UPDATE programs
    SET total_minutes = 42,
        total_calories = 1200,
        description = 'Quads, hamstrings, glutes, calves — a realistic full lower body training session with strength and muscle-building focus.'
    WHERE id = 'lower-pro'
  `);

  sqlDb.exec(`DELETE FROM program_sessions WHERE program_id = 'lower-pro'`);

  for (const s of LOWER_SESSIONS) {
    stmts.insertProgramSession.run({
      id: s.id,
      program_id: 'lower-pro',
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
patchLowerProgram();

function patchDietPrograms() {
  sqlDb.run(`DELETE FROM program_sessions WHERE program_id IN ('diet-vegetarian','diet-keto','diet-mediterranean','diet-bulking','diet-cutting')`);
  sqlDb.run(`DELETE FROM programs WHERE id IN ('diet-vegetarian','diet-keto','diet-mediterranean','diet-bulking','diet-cutting')`);

  const NEW_DIET_PROGRAMS = [
    {
      id: 'diet-vegetarian', category: 'diet', name: 'Vegetarian Plan',
      difficulty: 'All levels', cover_color: 'lime',
      cover_image:  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=70',
      hero_image:   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 7, total_calories: 0,
      description: 'A 7-day plant-forward eating guide — complete proteins without meat, iron-rich meals, B12 and D3 support, and meal-prep strategies for muscle and performance.'
    },
    {
      id: 'diet-keto', category: 'diet', name: 'Keto Plan',
      difficulty: 'Intermediate', cover_color: 'orange',
      cover_image:  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=70',
      hero_image:   'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 7, total_calories: 0,
      description: 'A 7-day ketogenic protocol — fat adaptation, electrolyte management, net carb targets, meal structure and how to train effectively while in ketosis.'
    },
    {
      id: 'diet-mediterranean', category: 'diet', name: 'Mediterranean Diet',
      difficulty: 'All levels', cover_color: 'mint',
      cover_image:  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=70',
      hero_image:   'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 7, total_calories: 0,
      description: 'A 7-day Mediterranean eating plan — olive oil as primary fat, oily fish twice a week, legumes daily, whole grains and anti-inflammatory foods for long-term health and performance.'
    },
    {
      id: 'diet-bulking', category: 'diet', name: 'Bulking Plan',
      difficulty: 'All levels', cover_color: 'pink',
      cover_image:  '/bulking_plan.png',
      hero_image:   '/bulking_plan.png',
      total_minutes: 7, total_calories: 0,
      description: 'A 7-day muscle-building guide — calculated caloric surplus, protein optimization, high-performance carbohydrates, and recovery strategies for maximum hypertrophy.'
    },
    {
      id: 'diet-cutting', category: 'diet', name: 'Cutting Plan',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image:  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=70',
      hero_image:   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 7, total_calories: 0,
      description: 'A 7-day fat loss protocol — aggressive calorie management, muscle-sparing protein levels, satiety-focused meal templates, and metabolic health preservation.'
    }
  ];

  const VEGETARIAN_SESSIONS = [
    { id: 'veg-s1', ord: 1, name: 'Day 1 — Complete Proteins Without Meat', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: protein completeness, amino acid pairing.\n\nVegetarian proteins are often incomplete — they lack one or more essential amino acids. The fix is simple: pair complementary sources.\n\n• Rice + legumes (lentils, beans, chickpeas) — the classic pair. Together they provide all 9 essential amino acids.\n• Eggs + whole grain toast — 2 eggs on sourdough gives 16 g complete protein.\n• Greek yogurt (200 g) + hemp seeds (30 g) — 28 g protein, all amino acids covered.\n• Cottage cheese (150 g) — naturally complete due to casein content, 18 g protein.\n\nAim for 1.6–2.0 g protein per kg of bodyweight. As a vegetarian this is achievable — it just requires planning. Log your protein today and see where you land.' },
    { id: 'veg-s2', ord: 2, name: 'Day 2 — Iron Without Red Meat', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: iron absorption, non-haem iron sources.\n\nPlant-based iron (non-haem) is absorbed at only 2–20% versus 20–30% for meat iron. You can close the gap:\n\n• Always pair iron-rich foods with vitamin C. Lentil soup + a squeeze of lemon doubles iron absorption.\n• Iron-rich plant foods: lentils (6.6 mg/100 g cooked), spinach (2.7 mg/100 g), tofu (3.4 mg/100 g), pumpkin seeds (8.8 mg/100 g).\n• Avoid coffee or tea within 1 hour of iron-rich meals — tannins block absorption by up to 60%.\n• Calcium and iron compete for absorption — do not combine a big dairy serving with your main iron meal.\n\nMen need ~8 mg/day, women ~18 mg/day. Track today and see if you are hitting your target.' },
    { id: 'veg-s3', ord: 3, name: 'Day 3 — B12 and D3 Essentials', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: B12 supplementation, vitamin D3 sources.\n\nThese are the two nutrients most commonly deficient in vegetarians:\n\nVitamin B12:\n• Found almost exclusively in animal products. Eggs and dairy provide small amounts but rarely enough.\n• Supplement: 1,000 mcg methylcobalamin daily. B12 deficiency causes fatigue, poor cognition and nerve damage — symptoms appear slowly over months.\n\nVitamin D3:\n• Sun exposure (15–20 min midday on bare skin) is the best source, but seasonal.\n• Food sources are limited: eggs, fortified plant milks, UV-exposed mushrooms.\n• Supplement: 2,000–4,000 IU D3 daily, taken with a fat-containing meal.\n\nConsider a blood test every 6–12 months to confirm your levels are in range.' },
    { id: 'veg-s4', ord: 4, name: 'Day 4 — High-Protein Meal Templates', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: daily meal structure, protein distribution.\n\nSpread protein evenly across 4–5 meals. The body can only synthesise muscle from ~40 g protein per sitting.\n\nBreakfast (30–35 g): Greek yogurt parfait — 200 g yogurt + 30 g granola + berries + 30 g hemp seeds.\nLunch (35–40 g): Tofu stir-fry — 200 g firm tofu + edamame + brown rice.\nSnack (20–25 g): Cottage cheese (150 g) + 1 tbsp peanut butter + 1 banana.\nDinner (40–45 g): Lentil dal — 200 g cooked red lentils + basmati rice + spinach + yogurt raita.\n\nThis template hits 125–145 g protein for a 75 kg athlete at 1.7–1.9 g/kg. Adjust portions to match your target weight and activity level.' },
    { id: 'veg-s5', ord: 5, name: 'Day 5 — Omega-3 Without Fish', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: ALA, EPA and DHA — omega-3 fatty acids.\n\n• ALA (flaxseeds, chia seeds, walnuts) converts to EPA/DHA at only 5–10% — not enough on its own.\n• Best vegetarian EPA/DHA source: algal oil supplement (500–1,000 mg/day). Algae is where fish get their omega-3 from.\n• Daily ALA foods: 1 tbsp ground flaxseed on porridge (2.3 g ALA), 30 g walnuts (2.6 g ALA), 2 tbsp chia seeds (5 g ALA).\n\nCombine daily ALA-rich foods with an algal oil supplement for complete omega-3 coverage.' },
    { id: 'veg-s6', ord: 6, name: 'Day 6 — Pre and Post Workout Nutrition', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: workout fuel, recovery nutrition (vegetarian-specific).\n\nPre-workout (60–90 min before):\n• Banana + 2 tbsp peanut butter + glass of oat milk — fast carbs, moderate protein.\n• Oat porridge (80 g dry) + scoop of plant protein — sustained energy for longer sessions.\n\nPost-workout (within 45 min):\n• Chocolate oat milk (400 ml) — ~20 g protein, 50 g carbs. Surprisingly effective.\n• Tofu scramble on sourdough — 200 g firm tofu + nutritional yeast + vegetables, 35 g protein.\n\nFor muscle building, the post-workout meal is the most important of the day. Never train and then wait hours to eat.' },
    { id: 'veg-s7', ord: 7, name: 'Day 7 — Weekly Meal Prep Strategy', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: consistency, weekly planning, batch cooking.\n\nSunday prep checklist (90 minutes):\n✓ Cook a large batch of lentils or chickpeas (500 g dry) — base for 4–5 lunches/dinners\n✓ Cook brown rice or quinoa (400 g dry)\n✓ Boil 8–10 eggs — grab-and-go protein for 3 days\n✓ Prep overnight oats in 3 jars — 3 breakfasts done\n✓ Chop vegetables for stir-fries\n✓ Mix a trail mix of nuts and seeds for snacks\n\nWith this prep done, hitting your protein and nutrient targets for 5 days becomes almost automatic. The decision fatigue is removed.' }
  ];

  const KETO_SESSIONS = [
    { id: 'keto-s1', ord: 1, name: 'Day 1 — What Keto Actually Is', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: ketosis basics, net carb calculation.\n\nKetosis is a metabolic state where your body burns fat (as ketones) instead of glucose. To enter and stay in ketosis:\n\n• Net carb limit: 20–25 g/day. Net carbs = total carbs minus fibre minus sugar alcohols.\n• Macros: 70–75% fat, 20–25% protein, 5% carbs.\n• Takes 2–4 days to enter ketosis, 3–6 weeks to become fully fat-adapted.\n\nNet carb reference:\n• 1 cup broccoli = 4 g net carbs ✓\n• 1 avocado = 2 g net carbs ✓\n• 1 slice bread = 14 g net carbs ✗\n• 1 banana = 24 g net carbs ✗ — your entire daily allowance\n\nToday, track every gram of carbohydrate you eat. Most people are shocked at how many hidden carbs they consume.' },
    { id: 'keto-s2', ord: 2, name: 'Day 2 — The Keto Flu and How to Beat It', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: electrolyte protocol — sodium, potassium, magnesium.\n\nDays 2–5 are the hardest. As carbs drop, kidneys excrete sodium rapidly, dragging other electrolytes with it. This causes headache, fatigue, brain fog and cramps — the keto flu.\n\nThis is not a sign keto is wrong. Fix it:\n\n• Sodium: add 2–3 g extra salt per day. This is the most impactful change.\n• Potassium: avocado (700 mg each), leafy greens, salmon. Target 3,000–4,500 mg/day.\n• Magnesium: 300–400 mg supplement before bed — also improves sleep and reduces cramps.\n\nPractical: drink 1 cup of salted bone broth or electrolyte water (no sugar) every morning during the first week. This single habit eliminates most keto flu symptoms.' },
    { id: 'keto-s3', ord: 3, name: 'Day 3 — Keto Food List and Meal Templates', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: approved foods, daily meal structure.\n\nEAT FREELY:\n• Fats: olive oil, butter, avocado oil, avocados, macadamia nuts, pecans\n• Protein: beef, lamb, chicken (skin-on), salmon, sardines, eggs, full-fat dairy\n• Vegetables: leafy greens, courgette, broccoli, cauliflower, cabbage, mushrooms\n\nNEVER EAT:\n• All grains, legumes, fruit (except small berries), root vegetables, bread, pasta, rice\n\nSample day (16 g net carbs total):\n• Breakfast: 3 eggs scrambled in butter + 2 bacon rashers + spinach (2 g)\n• Lunch: large salad with grilled chicken, olive oil, avocado, feta (6 g)\n• Dinner: pan-fried salmon + broccoli with butter + 30 g almonds (8 g)' },
    { id: 'keto-s4', ord: 4, name: 'Day 4 — Protein on Keto', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: protein targets, the gluconeogenesis myth.\n\nThe concern that "too much protein kicks you out of ketosis" is overstated. Gluconeogenesis is demand-driven, not supply-driven. Reality:\n\n• Aim for 1.6–2.2 g per kg of bodyweight if training. Do not under-eat protein.\n• Under-eating protein on keto causes muscle loss — a far bigger problem than slightly elevated glucose.\n\nBest fatty protein sources for keto:\n• Ribeye steak — 27 g protein, 18 g fat per 150 g\n• Salmon fillet — 34 g protein, 14 g fat per 150 g\n• Whole eggs — 6 g protein, 5 g fat each\n• Full-fat Greek yogurt (plain) — 10 g protein/100 g (check carbs: ~5 g/100 g, limit to 150 g/day)' },
    { id: 'keto-s5', ord: 5, name: 'Day 5 — Training on Keto', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: fat-adapted performance, targeted keto for lifting.\n\nDuring the first 3–6 weeks, performance will drop. This is normal — your body is learning to run on fat. Be patient.\n\nAfter fat adaptation:\n• Endurance (Zone 2) improves — fat is a near-unlimited fuel source.\n• High-intensity lifting depends on glycogen, which is limited on keto.\n\nSolutions for hard training days:\n• Targeted Keto (TKD): 15–30 g fast carbs (banana or dextrose) immediately before intense sessions only.\n• Cyclic Keto (CKD): strict keto 5 days, then a 24–48 hr carb refeed on weekends to restore glycogen.\n\nFor most gym-goers, straight keto with adequate sodium and protein is sufficient. Try TKD only if you feel flat on heavy lifting days.' },
    { id: 'keto-s6', ord: 6, name: 'Day 6 — Reading Labels and Eating Out', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: hidden carbs, restaurant strategy.\n\nHidden carbs derail most keto beginners:\n\n• Sauces: ketchup (4 g/tbsp), balsamic glaze (10 g/tbsp), teriyaki (13 g/tbsp) — excluded. Use olive oil, mayo, mustard, hot sauce.\n• "Low fat" foods always add sugar to compensate — avoid entirely.\n• Processed meats often contain fillers and added sugars — check labels.\n• Alcohol: dry wine (1–2 g/glass) is acceptable. Beer (12 g+) is not. Spirits are 0 g carbs but slow fat burning.\n\nRestaurant strategy:\n• Swap fries/rice/bread for extra salad or vegetables.\n• Ask for sauces on the side — most dressings are sugar-loaded.\n• Steak, grilled fish, salad with olive oil — the universal keto restaurant order.' },
    { id: 'keto-s7', ord: 7, name: 'Day 7 — Long-Term Keto and Metabolic Flexibility', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: long-term sustainability, blood markers, exit strategy.\n\nAfter 6–8 weeks, review these:\n\nWhat typically improves:\n• Triglycerides (often drop 30–50%)\n• HDL "good" cholesterol typically rises\n• Fasting blood sugar and insulin sensitivity\n• Body composition, particularly visceral fat\n\nWhat to monitor:\n• LDL cholesterol — varies by individual. A blood test at 8 weeks is strongly recommended.\n• Kidney stone risk is slightly elevated. Stay well hydrated (2.5–3 L water/day).\n\nMetabolic flexibility — the goal:\nAfter 3–6 months of keto, many athletes reintroduce carbs strategically (around training) while retaining fat-burning ability. You do not have to do keto forever — the fat adaptation effects persist long after you loosen carb restrictions.' }
  ];

  const MEDITERRANEAN_SESSIONS = [
    { id: 'med-s1', ord: 1, name: 'Day 1 — The Mediterranean Pyramid', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: food hierarchy, daily vs. weekly eating patterns.\n\nEat at every meal:\n• Extra-virgin olive oil as primary fat (2–4 tbsp/day)\n• Vegetables (at least 2 portions per meal)\n• Whole grains (sourdough, farro, bulgur, whole-grain pasta)\n• Legumes — at least 1 serving/day\n\nEat daily:\n• Fresh fruit (2–3 portions), nuts and seeds (30 g), unsweetened yogurt\n\nEat 2–3×/week:\n• Oily fish (salmon, sardines, mackerel), eggs, poultry in moderate amounts\n\nEat rarely:\n• Red meat (1–2×/month), processed foods, refined sugar, refined grains\n\nThis pattern has 50+ years of evidence: reduced all-cause mortality, lower cardiovascular risk and better cognitive ageing.' },
    { id: 'med-s2', ord: 2, name: 'Day 2 — Olive Oil: The Foundation Fat', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: oleic acid, oleocanthal anti-inflammatory effects, polyphenols.\n\nExtra-virgin olive oil (EVOO) is the most studied food in the Mediterranean diet:\n\n• Rich in oleic acid (monounsaturated fat) — reduces LDL oxidation, improves HDL.\n• Contains oleocanthal — a natural anti-inflammatory compound similar to ibuprofen at therapeutic doses.\n• Polyphenol content — high-quality EVOO reduces systemic inflammation and supports longevity.\n\nHow to use it:\n• 2–4 tbsp daily: on salads, drizzled over cooked vegetables, on sourdough instead of butter.\n• Buy cold-pressed, dark-bottled EVOO from the current harvest year.\n• EVOO is stable up to ~190°C — safe for sautéing and roasting.\n• "Olive oil" (not extra-virgin) has been refined and lacks most polyphenols.' },
    { id: 'med-s3', ord: 3, name: 'Day 3 — Oily Fish Twice a Week', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: omega-3 EPA and DHA, complete protein, micronutrients.\n\nTwo 140 g portions of oily fish per week provides ~2,000–3,000 mg EPA + DHA — the therapeutic dose for cardiovascular, joint and brain health.\n\nBest options (highest omega-3, lowest mercury):\n1. Sardines (canned in olive oil): 2.2 g omega-3/100 g — cheap, sustainable, add to salads.\n2. Mackerel (fresh or smoked): 2.5 g omega-3/100 g — pairs with horseradish or lemon.\n3. Wild salmon: 1.8–2.4 g omega-3/100 g — versatile, widely available.\n4. Anchovies: intense flavour, use in sauces and dressings.\n\nAvoid large fish (tuna, swordfish) more than once a week due to mercury. Small oily fish are the safer, more omega-3-dense choice.' },
    { id: 'med-s4', ord: 4, name: 'Day 4 — Legumes Every Day', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: dietary fibre, plant protein, gut microbiome, resistant starch.\n\nDaily legume consumption is one of the most consistent markers of longevity across all Blue Zone populations.\n\nWhy they matter:\n• Fibre: 8–15 g per serving — feeds beneficial gut bacteria, slows glucose absorption.\n• Protein: 7–10 g per 100 g cooked.\n• Resistant starch: feeds your microbiome and improves insulin sensitivity.\n\nEasy ways to eat legumes daily:\n• Hummus on wholegrain bread or with vegetables as a snack\n• Lentil or bean soup as a lunch staple (batch cook Sunday)\n• White beans with olive oil, garlic and herbs as a side\n• Add a tin of cannellini beans to stews or pasta sauce\n\nIf legumes cause bloating, start with smaller portions of rinsed canned varieties. The bloating reduces over 2–4 weeks.' },
    { id: 'med-s5', ord: 5, name: 'Day 5 — Anti-Inflammatory Foods', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: polyphenols, antioxidants, chronic inflammation reduction.\n\nKey anti-inflammatory foods to build meals around:\n\n• Tomatoes (lycopene) — especially cooked with olive oil, which dramatically increases lycopene absorption.\n• Dark leafy greens — spinach, rocket, cavolo nero (vitamin K, folate, antioxidants).\n• Berries — blueberries, strawberries, pomegranate (high polyphenol).\n• Walnuts — 30 g/day reduces inflammatory markers significantly in clinical trials.\n• Turmeric + black pepper — curcumin becomes 20× more bioavailable combined with piperine.\n• Green tea or coffee — both contain polyphenols associated with reduced inflammation.\n• Dark chocolate (85%+) — 20–30 g/day provides flavanols that improve endothelial function.\n\nShop the perimeter of the supermarket. The most anti-inflammatory foods are fresh, whole and minimally processed.' },
    { id: 'med-s6', ord: 6, name: 'Day 6 — Whole Grains Over Refined', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: glycaemic index, fibre, B vitamins, sustained energy.\n\nThe Mediterranean diet includes carbs — always in their least processed form:\n\n• White pasta → whole-grain pasta or farro. Farro has 3× the fibre and a satisfying texture.\n• White rice → bulgur wheat or freekeh. Both are Mediterranean staples.\n• Processed bread → authentic sourdough on whole-grain flour. Fermentation lowers the glycaemic response.\n• Crackers → rye crispbreads (3 g fibre per cracker, very filling).\n\nThe goal is not to eliminate carbs but to make every gram earn its place with fibre, nutrients and low glycaemic impact.' },
    { id: 'med-s7', ord: 7, name: 'Day 7 — A Full Week in Practice', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: weekly meal planning, the 80/20 principle, sustainability.\n\nA full Mediterranean week:\nMon: Lentil soup + sourdough; grilled salmon + farro + roasted broccoli\nTue: Greek yogurt + walnuts + honey; chickpea salad + feta; chicken with tomato sauce + whole-grain pasta\nWed: Avocado + egg on rye toast; sardine salad with capers; lamb kofta + tabbouleh + hummus\nThu: Overnight oats + berries; bean and vegetable minestrone; sea bass + asparagus + olive oil\nFri: Spinach omelette + sourdough; smoked mackerel + cucumber salad; prawn + cherry tomato pasta\nSat: Mezze spread: hummus, tabbouleh, feta, olives, flatbread; seafood stew\nSun: Shakshuka (eggs in tomato sauce); slow-roasted lamb + roasted vegetables + tzatziki\n\nThe 80/20 rule: studies show that 70–80% adherence delivers the vast majority of longevity benefits. The pattern matters more than any individual meal.' }
  ];

  const BULKING_SESSIONS = [
    { id: 'bulk-s1', ord: 1, name: 'Day 1 — The Math of Mass', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: caloric surplus, TDEE calculation, weight gain rate.\n\nTo build muscle, you need a surplus. For most, a 250–500 kcal surplus above maintenance is the "sweet spot".\n\n• Maintenance (TDEE): ~14–16 kcal per lb of bodyweight (depending on activity).\n• Target: gain ~0.25–0.5 kg (0.5–1 lb) per week. Faster than this usually results in excessive fat gain.\n• Example: If maintenance is 2500, target 2800–3000.\n\nAvoid "Dirty Bulking" (pizza and ice cream). While it provides the calories, the lack of micronutrients and excessive saturated fat can impair recovery and hormonal health.' },
    { id: 'bulk-s2', ord: 2, name: 'Day 2 — Protein: The Building Block', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: MPS, leucine threshold, protein timing.\n\nMuscle Protein Synthesis (MPS) is highest when you spread protein throughout the day.\n\n• Daily Target: 1.8–2.2 g per kg of bodyweight.\n• Per Meal: Aim for 30–45 g per meal, 4–5 times a day.\n• Leucine: The key amino acid that "triggers" growth. Found in high amounts in whey, beef, chicken, and eggs.\n\nToday, ensure your first and last meals of the day contain at least 35 g of high-quality protein.' },
    { id: 'bulk-s3', ord: 3, name: 'Day 3 — Carbs: The Fuel for Growth', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: glycogen replenishment, insulin response, performance fuel.\n\nCarbohydrates are protein-sparing — they provide the energy so your body doesn\'t burn protein for fuel.\n\n• Target: 4–7 g per kg of bodyweight.\n• Timing: Concentrate 40% of your daily carbs in the 2 hours before and after your workout.\n• Best sources: Rice, oats, sweet potatoes, pasta, and fruit.\n\nAdequate carbs allow you to train harder for longer, which is the primary driver of muscle growth.' },
    { id: 'bulk-s4', ord: 4, name: 'Day 4 — Healthy Fats for Hormones', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: testosterone production, calorie density.\n\nFats are essential for hormone production, including testosterone. Don\'t drop them too low.\n\n• Target: 0.8–1.0 g per kg of bodyweight (approx 20–30% of total calories).\n• Sources: Avocado, olive oil, nuts, seeds, and fatty fish.\n\nFats are also the most calorie-dense macro (9 kcal/g), making it easier to hit your high caloric targets if you have a low appetite.' },
    { id: 'bulk-s5', ord: 5, name: 'Day 5 — Recovery & Sleep', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: GH secretion, systemic recovery, CNS rest.\n\nYou don\'t grow in the gym; you grow while you sleep. Growth Hormone (GH) peaks during deep sleep.\n\n• Target: 7–9 hours of high-quality sleep.\n• Protocol: No screens 30 mins before bed, cool room temperature, and consistent wake/sleep times.\n\nIf you are training hard but not growing, check your sleep before you check your calories.' },
    { id: 'bulk-s6', ord: 6, name: 'Day 6 — Supplementing the Bulk', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: Creatine monohydrate, Caffeine, Whey protein.\n\nSupplements are the 5% on top of the 95% (diet/training).\n\n• Creatine: 5 g daily, forever. It\'s the most researched and effective legal supplement for strength and mass.\n• Caffeine: 200–400 mg pre-workout to improve intensity.\n• Whey/Plant Protein: A convenience tool to help hit your daily protein targets.\n\nFocus on whole foods first, supplements second.' },
    { id: 'bulk-s7', ord: 7, name: 'Day 7 — Consistency vs. Perfection', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2ec61f?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: long-term adherence, tracking, progressive overload.\n\nMuscle growth takes time. A "bulk" should last at least 12–16 weeks for meaningful results.\n\n• Log everything: use the SpotMe tracker for weights and a calorie app for food.\n• Progressive Overload: You must be getting stronger over time to justify the extra calories.\n• Rest days: Don\'t skip them. They are when the growth happens.\n\nStick to the plan even on days you don\'t feel like eating. Consistency is king.' }
  ];

  const CUTTING_SESSIONS = [
    { id: 'cut-s1', ord: 1, name: 'Day 1 — The Deficit Protocol', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: caloric deficit, fat loss math, sustainability.\n\nFat loss requires a deficit. A 500 kcal deficit per day usually results in ~0.5 kg fat loss per week.\n\n• Maintenance (TDEE): Calculate your maintenance and subtract 20–25%.\n• Target: lose 0.5–1% of bodyweight per week. Faster than this increases the risk of muscle loss.\n• Example: If maintenance is 2500, target 1900–2000.\n\nConsistency is more important than the size of the deficit. A moderate deficit you can stick to for 8 weeks is better than an aggressive one you quit after 3 days.' },
    { id: 'cut-s2', ord: 2, name: 'Day 2 — Protein Sparing', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: muscle preservation, TEF, satiety.\n\nProtein is even more important on a cut than on a bulk. It protects your muscle from being burned for energy.\n\n• Target: 2.0–2.4 g per kg of bodyweight. Higher than bulking levels.\n• Satiety: Protein is the most satiating macro — it keeps you full for longer.\n• TEF: Thermic Effect of Food. Your body burns more calories digesting protein than carbs or fats.\n\nEvery meal today must have a solid protein source (25 g+).' },
    { id: 'cut-s3', ord: 3, name: 'Day 3 — Volume Eating', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: satiety strategies, calorie density, fiber.\n\nHunger is the #1 enemy of a cut. Beat it with volume.\n\n• Low Calorie Density: Eat foods that take up a lot of space in your stomach for very few calories.\n• Leafy greens, broccoli, cauliflower, zucchini, and cucumbers should make up 50% of your plate.\n• Fiber: Aim for 30–40 g per day to slow digestion and keep you full.\n\nTry "The Big Salad": a massive bowl of greens with lean protein and low-calorie dressing. It feels like a huge meal but is only 300–400 kcal.' },
    { id: 'cut-s4', ord: 4, name: 'Day 4 — Cardio & NEAT', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: energy expenditure, metabolic adaptation, step counts.\n\nDon\'t just rely on eating less; move more. NEAT (Non-Exercise Activity Thermogenesis) is huge.\n\n• Steps: Aim for 10,000+ steps daily. It\'s the easiest way to burn extra calories without increasing hunger.\n• LISS: Low Intensity Steady State cardio (walking, incline walk) is better for muscle preservation than HIIT during a cut.\n• Watch out: Your body will try to make you move less as you get deeper into a cut. Stay active consciously.' },
    { id: 'cut-s5', ord: 5, name: 'Day 5 — Refeeds & Diet Breaks', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: leptin regulation, psychological relief, performance.\n\nLong-term dieting can slow your metabolism and cause "diet fatigue".\n\n• Refeed: 1–2 days a week eating at maintenance calories (mostly extra carbs). This boosts leptin and refills glycogen.\n• Diet Break: Every 6–8 weeks, take a full week at maintenance calories to reset mentally and physically.\n\nThese aren\'t "cheat days". They are calculated tools to keep the fat loss moving in the long run.' },
    { id: 'cut-s6', ord: 6, name: 'Day 6 — Sleep & Cortisol', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: stress management, visceral fat, muscle sparing.\n\nSleep deprivation increases cortisol, which promotes muscle loss and water retention (which masks fat loss).\n\n• Goal: 7–8 hours of sleep. Lack of sleep also increases hunger hormones (ghrelin).\n• Stress: High stress makes it harder to stick to the diet. Practice 5 mins of deep breathing or a walk in nature.\n\nIf the scale doesn\'t move for a week but you are sticking to the plan, it\'s likely just water retention from stress. Stay the course.' },
    { id: 'cut-s7', ord: 7, name: 'Day 7 — Long-Term Maintenance', sets: 3, reps: null, minutes: null,
      thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=60',
      tips: 'Primary: exit strategy, reverse dieting, habit formation.\n\nThe hardest part of a cut isn\'t losing the weight; it\'s keeping it off.\n\n• Reverse Diet: Slowly increase calories back to maintenance over 2–4 weeks to avoid rapid fat regain.\n• New Baseline: Your maintenance calories will be lower now that you weigh less. Adjust your expectations.\n• Habits: Keep the high-protein and high-volume vegetable habits you built.\n\nA successful cut ends with you being able to maintain your new weight comfortably.' }
  ];

  for (const p of NEW_DIET_PROGRAMS) {
    sqlDb.run(
      `INSERT OR REPLACE INTO programs (id, category, name, difficulty, cover_color, cover_image, hero_image, total_minutes, total_calories, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.category, p.name, p.difficulty, p.cover_color, p.cover_image, p.hero_image, p.total_minutes, p.total_calories, p.description]
    );
  }
  for (const s of VEGETARIAN_SESSIONS)    stmts.insertProgramSession.run({ id: s.id, program_id: 'diet-vegetarian',   ord: s.ord, name: s.name, sets: s.sets, reps: s.reps, minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips });
  for (const s of KETO_SESSIONS)           stmts.insertProgramSession.run({ id: s.id, program_id: 'diet-keto',          ord: s.ord, name: s.name, sets: s.sets, reps: s.reps, minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips });
  for (const s of MEDITERRANEAN_SESSIONS)  stmts.insertProgramSession.run({ id: s.id, program_id: 'diet-mediterranean', ord: s.ord, name: s.name, sets: s.sets, reps: s.reps, minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips });
  for (const s of BULKING_SESSIONS)        stmts.insertProgramSession.run({ id: s.id, program_id: 'diet-bulking',        ord: s.ord, name: s.name, sets: s.sets, reps: s.reps, minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips });
  for (const s of CUTTING_SESSIONS)        stmts.insertProgramSession.run({ id: s.id, program_id: 'diet-cutting',        ord: s.ord, name: s.name, sets: s.sets, reps: s.reps, minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips });
  persist();
}
patchDietPrograms();

/* ---------- patch: muscle programs — real exercises + MuscleMap tips ----------
   Runs on every boot. Replaces generic session names for upper-pro, lower-pro,
   core-beginner with real exercises. Inserts push-day, pull-day, leg-day if
   they do not yet exist. */
function patchMusclePrograms() {
  const MUSCLE_SESSIONS = {
    'upper-pro': [
      { id: 'upper-pro-s1', ord: 1, name: 'Bench Press', sets: 4, reps: 10, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: chest, shoulders, triceps\nLie flat, bar over mid-chest. Lower to touch, press up explosively. Keep shoulder blades pinched together throughout.' },
      { id: 'upper-pro-s2', ord: 2, name: 'Overhead Press', sets: 3, reps: 10, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders, triceps\nStart at shoulder height. Press bar overhead until arms locked out. Keep core braced, avoid flaring elbows.' },
      { id: 'upper-pro-s3', ord: 3, name: 'Bent-Over Row', sets: 4, reps: 10, minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, upper-back, biceps\nHinge at hips, back flat. Pull bar to lower sternum, squeeze shoulder blades at top. Lower with control.' }
    ],
    'lower-pro': [
      { id: 'lower-pro-s1', ord: 1, name: 'Squats', sets: 4, reps: 8, minutes: 15,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes\nFeet shoulder-width, bar on upper traps. Descend to parallel or below. Drive through heels, knees track over toes throughout.' },
      { id: 'lower-pro-s2', ord: 2, name: 'Romanian Deadlift', sets: 3, reps: 10, minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: hamstrings, glutes, lower-back\nHinge at hips with slight knee bend. Lower bar along legs until hamstring stretch. Drive hips forward to return.' },
      { id: 'lower-pro-s3', ord: 3, name: 'Leg Press', sets: 3, reps: 12, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes\nFeet shoulder-width on platform. Lower until 90°, press through heels. Keep lower back against pad throughout.' }
    ],
    'core-beginner': [
      { id: 'core-beginner-s1', ord: 1, name: 'Plank', sets: 3, reps: 1, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: abs, lower-back\nForearms on ground, body straight from head to heel. Squeeze abs and glutes. Hold for 30–60 seconds per set.' },
      { id: 'core-beginner-s2', ord: 2, name: 'Dead Bug', sets: 3, reps: 10, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: abs\nLie on back, arms up, knees at 90°. Slowly lower opposite arm and leg toward floor. Keep lower back pressed into ground throughout.' },
      { id: 'core-beginner-s3', ord: 3, name: 'Hollow Hold', sets: 3, reps: 1, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: abs\nLie on back, press lower back into floor. Lift shoulders and legs, arms overhead. Hold the position — this is gymnastics-level core activation.' }
    ]
  };

  const NEW_MUSCLE_PROGRAMS = [
    {
      id: 'push-day', category: 'muscle', name: 'Push Day',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 38, total_calories: 1400,
      description: 'Chest, shoulders and triceps — compound presses plus isolation work for full push-muscle development.'
    },
    {
      id: 'pull-day', category: 'muscle', name: 'Pull Day',
      difficulty: 'Intermediate', cover_color: 'mint',
      cover_image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=70',
      hero_image:  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1200&q=70',
      total_minutes: 38, total_calories: 1300,
      description: 'Back and biceps — pull-ups, rows and curls for width, thickness and arm strength.'
    },
    {
      id: 'leg-day', category: 'muscle', name: 'Leg Day',
      difficulty: 'Intermediate', cover_color: 'lime',
      cover_image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=800&q=80',
      hero_image:  'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=80',
      total_minutes: 43, total_calories: 1600,
      description: 'Quads, hamstrings, glutes and calves — squat-based lower body programme for size and strength.'
    }
  ];

  const NEW_MUSCLE_SESSIONS = {
    'push-day': [
      { id: 'push-day-s1', ord: 1, name: 'Bench Press', sets: 4, reps: 10, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: chest, shoulders, triceps\nLie flat, bar over mid-chest. Lower to touch, press up explosively. Keep shoulder blades pinched together throughout.' },
      { id: 'push-day-s2', ord: 2, name: 'Overhead Press', sets: 3, reps: 10, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders, triceps\nStart at shoulder height. Press overhead until locked out. Brace core, avoid arching the lower back.' },
      { id: 'push-day-s3', ord: 3, name: 'Incline Dumbbell Press', sets: 3, reps: 12, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: chest, shoulders\nBench at 30–45°. Press dumbbells up and slightly together. Stretch at the bottom, squeeze at the top.' },
      { id: 'push-day-s4', ord: 4, name: 'Lateral Raises', sets: 3, reps: 15, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: shoulders\nLight dumbbells, slight elbow bend. Raise to shoulder height only. Pause at top — the lowering phase builds the muscle.' },
      { id: 'push-day-s5', ord: 5, name: 'Tricep Pushdown', sets: 3, reps: 12, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: triceps\nElbows pinned to sides. Push bar or rope down until arms fully extend. Squeeze hard at the bottom, return with control.' }
    ],
    'pull-day': [
      { id: 'pull-day-s1', ord: 1, name: 'Pull-ups', sets: 3, reps: 8, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, biceps\nHang, shoulder-width grip. Drive elbows down to pull chest to bar. Full hang at bottom, chin over bar at top.' },
      { id: 'pull-day-s2', ord: 2, name: 'Barbell Row', sets: 4, reps: 8, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, upper-back, biceps\nHinge at hips, back flat. Pull bar to lower sternum, elbows 45° from body. Squeeze shoulder blades hard at the top.' },
      { id: 'pull-day-s3', ord: 3, name: 'Face Pulls', sets: 3, reps: 15, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: rear-delts, traps\nCable at head height. Pull rope to forehead, elbows flared high. Pause and externally rotate at end range.' },
      { id: 'pull-day-s4', ord: 4, name: 'Lat Pulldown', sets: 3, reps: 10, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: lats, biceps\nWide overhand grip. Lean back slightly, pull bar to upper chest. Initiate with elbows, not hands.' },
      { id: 'pull-day-s5', ord: 5, name: 'Bicep Curls', sets: 3, reps: 12, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: biceps, forearms\nShoulder-width grip, elbows fixed. Curl fully, squeeze at top. Lower slowly — 3-second eccentric for max growth.' }
    ],
    'leg-day': [
      { id: 'leg-day-s1', ord: 1, name: 'Squats', sets: 4, reps: 8, minutes: 12,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes\nFeet shoulder-width, bar on upper traps. Descend to parallel or below. Drive through heels, knees track over toes.' },
      { id: 'leg-day-s2', ord: 2, name: 'Romanian Deadlift', sets: 4, reps: 10, minutes: 10,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: hamstrings, glutes, lower-back\nHinge at hips with soft knees. Lower bar along shins until hamstring stretch. Drive hips through to stand.' },
      { id: 'leg-day-s3', ord: 3, name: 'Leg Press', sets: 3, reps: 12, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes\nHigh foot placement targets glutes; low foot placement targets quads. Never lock out knees at the top.' },
      { id: 'leg-day-s4', ord: 4, name: 'Lunges', sets: 3, reps: 12, minutes: 8,
        thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: quads, glutes, hamstrings\nStep forward, lower back knee to near-floor. Front shin vertical, weight through front heel. Alternate legs each rep.' },
      { id: 'leg-day-s5', ord: 5, name: 'Calf Raises', sets: 4, reps: 15, minutes: 5,
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=60',
        tips: 'Primary: calves\nStand on step edge, heels hanging off. Rise as high as possible, pause at top. Lower all the way for full stretch. Slow reps for maximum activation.' }
    ]
  };

  sqlDb.run(`
    UPDATE programs SET name = 'Upper Body', total_minutes = 30,
      description = 'Chest, shoulders, back and arms — three compound lifts to build balanced upper body strength.'
    WHERE id = 'upper-pro'
  `);
  sqlDb.run(`
    UPDATE programs SET name = 'Lower Body',
      description = 'Quads, hamstrings, glutes — three key lower body lifts for strength and muscle.'
    WHERE id = 'lower-pro'
  `);

  for (const [programId, sessions] of Object.entries(MUSCLE_SESSIONS)) {
    sqlDb.run(`DELETE FROM program_sessions WHERE program_id = ?`, [programId]);
    for (const s of sessions) {
      stmts.insertProgramSession.run({
        id: s.id, program_id: programId,
        ord: s.ord, name: s.name, sets: s.sets, reps: s.reps,
        minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips
      });
    }
  }

  for (const p of NEW_MUSCLE_PROGRAMS) {
    const exists = sqlDb.exec(`SELECT id FROM programs WHERE id = '${p.id}'`);
    if (!exists?.[0]?.values?.length) {
      sqlDb.run(
        `INSERT INTO programs (id, category, name, difficulty, cover_color, cover_image, hero_image, total_minutes, total_calories, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.category, p.name, p.difficulty, p.cover_color, p.cover_image, p.hero_image, p.total_minutes, p.total_calories, p.description]
      );
    } else {
      sqlDb.run(
        `UPDATE programs SET name=?, difficulty=?, cover_color=?, cover_image=?, hero_image=?, total_minutes=?, total_calories=?, description=? WHERE id=?`,
        [p.name, p.difficulty, p.cover_color, p.cover_image, p.hero_image, p.total_minutes, p.total_calories, p.description, p.id]
      );
    }
    sqlDb.run(`DELETE FROM program_sessions WHERE program_id = ?`, [p.id]);
    for (const s of NEW_MUSCLE_SESSIONS[p.id]) {
      stmts.insertProgramSession.run({
        id: s.id, program_id: p.id,
        ord: s.ord, name: s.name, sets: s.sets, reps: s.reps,
        minutes: s.minutes, thumbnail: s.thumbnail, tips: s.tips
      });
    }
  }

  persist();
}
patchMusclePrograms();

stmts.cleanExpiredTokens.run();
setInterval(() => stmts.cleanExpiredTokens.run(), 60 * 60 * 1000);

export const db = { open: true, persist };
