/*
 * White-Box Unit Tests — _shared.js
 *
 * Covers:
 *   - ApiError  (class structure)
 *   - newToken  (output format)
 *   - publicUser (field projection)
 *   - requireAuth (middleware logic — all branches)
 *
 * Technique: statement + branch coverage via direct function calls.
 * DB is mocked so these tests have no I/O.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── vi.hoisted ensures mock vars exist before vi.mock runs ── */
const { mockGetToken, mockGetById, mockDeleteToken } = vi.hoisted(() => ({
  mockGetToken:    vi.fn(),
  mockGetById:     vi.fn(),
  mockDeleteToken: vi.fn(),
}));

vi.mock('../../server/db.js', () => ({
  stmts: {
    getToken:    { get: mockGetToken    },
    getUserById: { get: mockGetById     },
    deleteToken: { run: mockDeleteToken },
  },
  db: { open: true, persist: vi.fn() },
}));

import { ApiError, newToken, publicUser, requireAuth } from '../../server/routes/_shared.js';

/* ────────────────────────────────────────────────────────── */

describe('ApiError', () => {
  it('stores status and message', () => {
    const e = new ApiError(404, 'Not found');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.message).toBe('Not found');
  });

  it('inherits from Error', () => {
    expect(new ApiError(500, 'x')).toBeInstanceOf(Error);
  });
});

/* ────────────────────────────────────────────────────────── */

describe('newToken', () => {
  it('returns a 64-char hex string', () => {
    const t = newToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a different value each call', () => {
    expect(newToken()).not.toBe(newToken());
  });
});

/* ────────────────────────────────────────────────────────── */

describe('publicUser', () => {
  const rawUser = {
    id: 1, email: 'a@b.com',
    password_hash: '$2a$11$xxxxx',
    first_name: 'Alice', last_name: 'Smith',
    country_code: 'GB', phone: '07700',
    level: 'intermediate',
    weight: 70, weight_unit: 'kg',
    height: 175, height_unit: 'cm',
    plays_sport: 'yes', sport_name: 'Football',
    training_goal: 'Build muscle',
    plan: 'free', avatar_url: null,
    created_at: 1700000000, updated_at: 1700000001,
  };

  it('strips password_hash and timestamps', () => {
    const out = publicUser(rawUser);
    expect(out.password_hash).toBeUndefined();
    expect(out.created_at).toBeUndefined();
    expect(out.updated_at).toBeUndefined();
  });

  it('maps snake_case to camelCase', () => {
    const out = publicUser(rawUser);
    expect(out.firstName).toBe('Alice');
    expect(out.lastName).toBe('Smith');
    expect(out.countryCode).toBe('GB');
    expect(out.weightUnit).toBe('kg');
    expect(out.heightUnit).toBe('cm');
    expect(out.playsSport).toBe('yes');
    expect(out.sportName).toBe('Football');
    expect(out.trainingGoal).toBe('Build muscle');
    expect(out.avatarUrl).toBeNull();
  });

  it('returns null for null input', () => {
    expect(publicUser(null)).toBeNull();
  });

  it('preserves id, email, plan', () => {
    const out = publicUser(rawUser);
    expect(out.id).toBe(1);
    expect(out.email).toBe('a@b.com');
    expect(out.plan).toBe('free');
  });
});

/* ────────────────────────────────────────────────────────── */

describe('requireAuth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req  = { headers: {} };
    res  = {};
    next = vi.fn();
    mockGetToken.mockReset();
    mockGetById.mockReset();
    mockDeleteToken.mockReset();
  });

  it('calls next(ApiError 401) when Authorization header is missing', () => {
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });

  it('calls next(ApiError 401) when header is not Bearer format', () => {
    req.headers.authorization = 'Basic dXNlcjpwYXNz';
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  it('calls next(ApiError 401) when token is not in DB', () => {
    req.headers.authorization = 'Bearer unknowntoken';
    mockGetToken.mockReturnValue(undefined);
    requireAuth(req, res, next);
    expect(mockGetToken).toHaveBeenCalledWith('unknowntoken');
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  it('deletes expired token and calls next(ApiError 401)', () => {
    const expiredRow = {
      token: 'tok', user_id: 1,
      expires_at: Math.floor(Date.now() / 1000) - 1,
    };
    req.headers.authorization = 'Bearer tok';
    mockGetToken.mockReturnValue(expiredRow);
    requireAuth(req, res, next);
    expect(mockDeleteToken).toHaveBeenCalledWith('tok');
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/expired/i);
  });

  it('calls next(ApiError 401) when user no longer exists', () => {
    const validRow = {
      token: 'tok', user_id: 999,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    req.headers.authorization = 'Bearer tok';
    mockGetToken.mockReturnValue(validRow);
    mockGetById.mockReturnValue(undefined);
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  it('attaches req.user and req.token on success and calls next()', () => {
    const validRow = {
      token: 'goodtoken', user_id: 1,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const user = { id: 1, email: 'x@y.com' };
    req.headers.authorization = 'Bearer goodtoken';
    mockGetToken.mockReturnValue(validRow);
    mockGetById.mockReturnValue(user);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBe(user);
    expect(req.token).toBe('goodtoken');
  });
});
