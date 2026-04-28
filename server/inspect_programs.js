import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs();
const dbPath = path.join(process.cwd(), 'spotme.sqlite');
const db = new SQL.Database(fs.readFileSync(dbPath));

const programsRes = db.exec('SELECT id,name,category,total_minutes,total_calories,description FROM programs');
const programs = programsRes?.[0]?.values || [];
console.log('PROGRAMS', programs.length);
for (const row of programs) console.log(row);

const sessionsRes = db.exec('SELECT program_id,id,ord,name,sets,reps,minutes,tips FROM program_sessions ORDER BY program_id, ord');
const sessions = sessionsRes?.[0]?.values || [];
console.log('SESSIONS', sessions.length);
for (const row of sessions) console.log(row);
