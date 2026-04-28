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
`);

/* ---------- subscription schema migration ---------- */
// Add columns safely — ignore error if column already exists
[
  'ALTER TABLE users ADD COLUMN stripe_customer_id TEXT',
  'ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT',
  'ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT \'free\'',
  'ALTER TABLE users ADD COLUMN subscription_end INTEGER',
].forEach(sql => { try { sqlDb.exec(sql); } catch {} });

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

  deleteUser:         prep('DELETE FROM users WHERE id = ?'),

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
};

stmts.cleanExpiredTokens.run();
setInterval(() => stmts.cleanExpiredTokens.run(), 60 * 60 * 1000);

export const db = { open: true, persist };
