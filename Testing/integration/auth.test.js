/*
 * Black-Box Integration Tests — Auth routes
 *
 * Techniques applied:
 *   - Equivalence Partitioning  (EP)
 *   - Boundary Value Analysis   (BVA)
 *   - Decision Tables           (DT)
 *   - State-Transition Testing  (ST)
 *   - Use-Case Scenarios        (UC)
 *
 * DB: fresh in-memory sql.js instance per test file; tables cleared
 *     before each test via reset().
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

/* ── Mock db.js with real in-memory sql.js ── */
vi.mock('../../server/db.js', async () => {
  const mod = await import('../helpers/in-memory-db.js');
  await mod.init();
  return { stmts: mod.stmts, db: mod.db };
});

import { reset } from '../helpers/in-memory-db.js';
import { makeApp } from '../helpers/make-app.js';

let app;
beforeAll(() => { app = makeApp(); });
beforeEach(() => reset());

/* ────────────────────────────────────────────────────────── */

const VALID_USER = {
  email:     'alice@example.com',
  password:  'AlicePass1!safe',
  firstName: 'Alice',
  lastName:  'Smith',
};

async function signup(overrides = {}) {
  return request(app).post('/api/auth/signup')
    .send({ ...VALID_USER, ...overrides });
}

async function login(email = VALID_USER.email, password = VALID_USER.password) {
  return request(app).post('/api/auth/login').send({ email, password });
}

/* ────────────────────── GET /api/health ─────────────────── */

describe('GET /api/health', () => {
  it('returns ok:true (UC-001)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

/* ──────────────────── POST /api/auth/signup ─────────────── */

describe('POST /api/auth/signup — EP valid partition', () => {
  it('creates account and returns token + user (UC-002)', async () => {
    const res = await signup();
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('includes profile fields in response', async () => {
    const res = await signup({ level: 'beginner', weight: 70, weightUnit: 'kg' });
    expect(res.status).toBe(200);
    expect(res.body.user.level).toBe('beginner');
    expect(res.body.user.weight).toBe(70);
  });
});

describe('POST /api/auth/signup — EP duplicate email (DT-001)', () => {
  it('returns 409 on duplicate email', async () => {
    await signup();
    const res = await signup();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('is case-insensitive on duplicate check', async () => {
    await signup();
    const res = await signup({ email: 'ALICE@EXAMPLE.COM' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/signup — EP invalid fields', () => {
  it('400 on missing email (EP-invalid-email)', async () => {
    const res = await signup({ email: 'notanemail' });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body.error || '{}');
    expect(body.fieldErrors?.email).toBeTruthy();
  });

  it('400 on invalid email missing @', async () => {
    const res = await signup({ email: 'alice.example.com' });
    expect(res.status).toBe(400);
  });

  it('400 on firstName with digits (EP-invalid-name)', async () => {
    const res = await signup({ firstName: 'Al1ce' });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body.error || '{}');
    expect(body.fieldErrors?.firstName).toBeTruthy();
  });

  it('400 when firstName === lastName (DT-002)', async () => {
    const res = await signup({ firstName: 'Same', lastName: 'Same' });
    expect(res.status).toBe(400);
  });

  it('400 on invalid experience level (EP-invalid-level)', async () => {
    const res = await signup({ level: 'expert' });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body.error || '{}');
    expect(body.fieldErrors?.level).toBeTruthy();
  });
});

describe('POST /api/auth/signup — BVA password length', () => {
  it('400 for password of exactly 11 chars (below boundary)', async () => {
    const res = await signup({ password: 'Short1!xxxx' });
    expect(res.status).toBe(400);
  });

  it('200 for password of exactly 12 chars (at boundary)', async () => {
    const res = await signup({ password: 'ShortPass1!x' });
    expect(res.status).toBe(200);
  });

  it('400 for password with no uppercase', async () => {
    const res = await signup({ password: 'allowercase1!' });
    expect(res.status).toBe(400);
  });

  it('400 for password with no digit', async () => {
    const res = await signup({ password: 'NoNumberHere!!' });
    expect(res.status).toBe(400);
  });

  it('400 for password with no symbol', async () => {
    const res = await signup({ password: 'NoSymbolHere12' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/signup — BVA weight/height', () => {
  it('200 for weight at boundary 500', async () => {
    const res = await signup({ weight: 500 });
    expect(res.status).toBe(200);
  });

  it('400 for weight above boundary 501', async () => {
    const res = await signup({ weight: 501 });
    expect(res.status).toBe(400);
  });

  it('400 for weight of 0 (lower boundary)', async () => {
    const res = await signup({ weight: 0 });
    expect(res.status).toBe(400);
  });

  it('400 for negative weight', async () => {
    const res = await signup({ weight: -1 });
    expect(res.status).toBe(400);
  });

  it('200 for height at boundary 300', async () => {
    const res = await signup({ height: 300 });
    expect(res.status).toBe(200);
  });

  it('400 for height above boundary 301', async () => {
    const res = await signup({ height: 301 });
    expect(res.status).toBe(400);
  });
});

/* ──────────────────── POST /api/auth/login ──────────────── */

describe('POST /api/auth/login — Decision Table (DT-003)', () => {
  beforeEach(async () => { await signup(); });

  it('returns token on correct credentials', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('401 on wrong password', async () => {
    const res = await login(VALID_USER.email, 'WrongPass99!');
    expect(res.status).toBe(401);
  });

  it('401 on unknown email', async () => {
    const res = await login('nobody@x.com', VALID_USER.password);
    expect(res.status).toBe(401);
  });

  it('400 when password omitted', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: VALID_USER.email });
    expect(res.status).toBe(400);
  });

  it('400 when email is not valid format', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'badformat', password: VALID_USER.password });
    expect(res.status).toBe(400);
  });
});

/* ────────────────── GET /api/auth/me ────────────────────── */

describe('GET /api/auth/me (ST: authenticated state)', () => {
  it('returns user when token is valid (UC-003)', async () => {
    const { body: { token } } = await signup();
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_USER.email);
  });

  it('401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 with bogus token', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer aaaa');
    expect(res.status).toBe(401);
  });

  it('401 with malformed Authorization header', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'notbearer');
    expect(res.status).toBe(401);
  });
});

/* ─────────────────── POST /api/auth/logout ─────────────── */

describe('POST /api/auth/logout (ST: authenticated → unauthenticated)', () => {
  it('invalidates token so /me returns 401 afterwards (UC-004)', async () => {
    const { body: { token } } = await signup();

    const out = await request(app).post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);

    const check = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(check.status).toBe(401);
  });

  it('401 when no token provided to logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

/* ────────────────── DELETE /api/auth/account ────────────── */

describe('DELETE /api/auth/account (ST: account deleted)', () => {
  it('deletes account; subsequent login returns 401 (UC-005)', async () => {
    const { body: { token } } = await signup();

    const del = await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const res = await login();
    expect(res.status).toBe(401);
  });
});

/* ────────── Full state-transition scenario (ST-001) ────── */

describe('State-Transition: full user lifecycle', () => {
  it('unregistered → signup → login → logout → login → delete (ST-001)', async () => {
    let res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);

    res = await signup();
    expect(res.status).toBe(200);
    const token1 = res.body.token;

    res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);

    res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);

    res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(401);

    res = await login();
    expect(res.status).toBe(200);
    const token2 = res.body.token;

    res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);

    res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);

    res = await login();
    expect(res.status).toBe(401);
  });
});
