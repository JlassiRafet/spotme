/*
 * Black-Box Integration Tests — Sessions + Profile routes
 *
 * Techniques: Equivalence Partitioning, Boundary Value Analysis,
 *             State-Transition, Use-Case Scenarios
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../server/db.js', async () => {
  const mod = await import('../helpers/in-memory-db.js');
  await mod.init();
  return { stmts: mod.stmts, db: mod.db };
});

import { reset, stmts } from '../helpers/in-memory-db.js';
import { makeApp } from '../helpers/make-app.js';

let app, token, userId;
beforeAll(() => { app = makeApp(); });

beforeEach(async () => {
  reset();
  const nowSec = Math.floor(Date.now() / 1000);
  const info = stmts.insertUser.run({
    email: 'test@spotme.io', password_hash: '$2a$11$placeholder',
    first_name: 'Test', last_name: 'User',
    country_code: null, phone: null, level: 'beginner',
    weight: 75, weight_unit: 'kg',
    height: 180, height_unit: 'cm',
    plays_sport: null, sport_name: null, training_goal: null,
  });
  userId = info.lastInsertRowid;
  token = 'test-token-abcdef1234567890';
  stmts.insertToken.run(token, userId, nowSec + 3600);
});

function auth() {
  return { Authorization: `Bearer ${token}` };
}

/* ──────────────────── GET /api/sessions ─────────────────── */

describe('GET /api/sessions', () => {
  it('returns empty array when no sessions exist (EP-empty)', async () => {
    const res = await request(app).get('/api/sessions').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });

  it('returns list with created sessions (UC-010)', async () => {
    stmts.createSession.run(userId, 'Leg Day', '');
    stmts.createSession.run(userId, 'Pull Day', '');
    const res = await request(app).get('/api/sessions').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(2);
  });

  it('401 without auth', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(401);
  });

  it('only returns own sessions (EP-isolation)', async () => {
    const other = stmts.insertUser.run({
      email: 'other@x.com', password_hash: '$2a$11$x',
      first_name: 'Other', last_name: 'User',
      country_code: null, phone: null, level: null,
      weight: null, weight_unit: null, height: null, height_unit: null,
      plays_sport: null, sport_name: null, training_goal: null,
    });
    stmts.createSession.run(other.lastInsertRowid, 'Other session', '');
    stmts.createSession.run(userId, 'My session', '');

    const res = await request(app).get('/api/sessions').set(auth());
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].title).toBe('My session');
  });

  it('response shape includes expected fields', async () => {
    stmts.createSession.run(userId, 'Chest Day', '');
    const res = await request(app).get('/api/sessions').set(auth());
    const s = res.body.sessions[0];
    expect(s).toHaveProperty('id');
    expect(s).toHaveProperty('title');
    expect(s).toHaveProperty('tags');
    expect(s).toHaveProperty('createdAt');
    expect(s).toHaveProperty('updatedAt');
  });
});

/* ─────────────────── GET /api/sessions/:id ──────────────── */

describe('GET /api/sessions/:id', () => {
  let sessionId;
  beforeEach(() => {
    const r = stmts.createSession.run(userId, 'Back Day', '');
    sessionId = r.lastInsertRowid;
    stmts.insertMessage.run({
      session_id: sessionId, role: 'user',
      content: 'Help me train back', image_data_url: null, structured_json: null,
    });
  });

  it('returns session + messages (UC-011)', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.session.title).toBe('Back Day');
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].role).toBe('user');
  });

  it('404 for non-existent session (EP-not-found)', async () => {
    const res = await request(app).get('/api/sessions/99999').set(auth());
    expect(res.status).toBe(404);
  });

  it('404 for another user\'s session (EP-isolation)', async () => {
    const other = stmts.insertUser.run({
      email: 'o2@x.com', password_hash: '$2a$11$x',
      first_name: 'O', last_name: 'T',
      country_code: null, phone: null, level: null,
      weight: null, weight_unit: null, height: null, height_unit: null,
      plays_sport: null, sport_name: null, training_goal: null,
    });
    const s = stmts.createSession.run(other.lastInsertRowid, 'Private', '');
    const res = await request(app).get(`/api/sessions/${s.lastInsertRowid}`).set(auth());
    expect(res.status).toBe(404);
  });

  it('400 for invalid id format (BVA-non-integer)', async () => {
    const res = await request(app).get('/api/sessions/abc').set(auth());
    expect(res.status).toBe(400);
  });
});

/* ─────────────────── PATCH /api/sessions/:id ────────────── */

describe('PATCH /api/sessions/:id (rename)', () => {
  let sessionId;
  beforeEach(() => {
    const r = stmts.createSession.run(userId, 'Old Title', '');
    sessionId = r.lastInsertRowid;
  });

  it('renames session and returns new title (UC-012)', async () => {
    const res = await request(app).patch(`/api/sessions/${sessionId}`)
      .set(auth()).send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  it('400 when title is empty (BVA-empty-string)', async () => {
    const res = await request(app).patch(`/api/sessions/${sessionId}`)
      .set(auth()).send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('404 for non-existent session', async () => {
    const res = await request(app).patch('/api/sessions/99999')
      .set(auth()).send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('truncates title to 120 chars (BVA-max-length)', async () => {
    const longTitle = 'A'.repeat(200);
    const res = await request(app).patch(`/api/sessions/${sessionId}`)
      .set(auth()).send({ title: longTitle });
    expect(res.status).toBe(200);
    expect(res.body.title.length).toBe(120);
  });
});

/* ─────────────────── DELETE /api/sessions/:id ──────────────*/

describe('DELETE /api/sessions/:id (ST: session lifecycle)', () => {
  let sessionId;
  beforeEach(() => {
    const r = stmts.createSession.run(userId, 'Delete me', '');
    sessionId = r.lastInsertRowid;
  });

  it('deletes session; subsequent GET returns 404 (UC-013)', async () => {
    const del = await request(app).delete(`/api/sessions/${sessionId}`).set(auth());
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const get = await request(app).get(`/api/sessions/${sessionId}`).set(auth());
    expect(get.status).toBe(404);
  });

  it('404 on deleting non-existent session', async () => {
    const res = await request(app).delete('/api/sessions/99999').set(auth());
    expect(res.status).toBe(404);
  });

  it('404 on deleting another user\'s session', async () => {
    const other = stmts.insertUser.run({
      email: 'o3@x.com', password_hash: '$2a$11$x',
      first_name: 'O', last_name: 'T',
      country_code: null, phone: null, level: null,
      weight: null, weight_unit: null, height: null, height_unit: null,
      plays_sport: null, sport_name: null, training_goal: null,
    });
    const s = stmts.createSession.run(other.lastInsertRowid, 'Not mine', '');
    const res = await request(app).delete(`/api/sessions/${s.lastInsertRowid}`).set(auth());
    expect(res.status).toBe(404);
  });
});

/* ─────────────────── PATCH /api/profile ─────────────────── */

describe('PATCH /api/profile (UC-020)', () => {
  it('updates profile fields and returns updated user', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth())
      .send({ firstName: 'Updated', weight: 80, level: 'intermediate' });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Updated');
    expect(res.body.user.weight).toBe(80);
    expect(res.body.user.level).toBe('intermediate');
  });

  it('partial update: omitted fields stay unchanged', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth()).send({ weight: 90 });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Test');
    expect(res.body.user.weight).toBe(90);
  });

  it('400 for invalid firstName (EP-invalid-name)', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth()).send({ firstName: 'T3st123' });
    expect(res.status).toBe(400);
  });

  it('400 for invalid weight unit', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth()).send({ weightUnit: 'stones' });
    expect(res.status).toBe(400);
  });

  it('400 for invalid level', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth()).send({ level: 'master' });
    expect(res.status).toBe(400);
  });

  it('400 for weight above boundary (BVA-501)', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth()).send({ weight: 501 });
    expect(res.status).toBe(400);
  });

  it('400 for avatarUrl that is not a data:image/ URL', async () => {
    const res = await request(app).patch('/api/profile')
      .set(auth()).send({ avatarUrl: 'https://evil.com/x.jpg' });
    expect(res.status).toBe(400);
  });

  it('401 without auth', async () => {
    const res = await request(app).patch('/api/profile').send({ weight: 70 });
    expect(res.status).toBe(401);
  });
});

/* ─────────────────── POST /api/profile/upgrade ──────────── */

describe('POST /api/profile/upgrade (UC-021)', () => {
  it('returns Stripe checkout URL when payment is configured, otherwise 503', async () => {
    const res = await request(app).post('/api/profile/upgrade').set(auth());
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(String(res.body.error || '')).toMatch(/not configured|Payment/i);
    } else {
      expect(res.body.url).toMatch(/^https:\/\//);
    }
  });

  it('401 without auth', async () => {
    const res = await request(app).post('/api/profile/upgrade');
    expect(res.status).toBe(401);
  });
});
