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
`);

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

  deleteUser:         prep('DELETE FROM users WHERE id = ?')
};

stmts.cleanExpiredTokens.run();
setInterval(() => stmts.cleanExpiredTokens.run(), 60 * 60 * 1000);

export const db = { open: true, persist };
