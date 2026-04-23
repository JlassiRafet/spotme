/*
 * SpotMe — shared route helpers
 * ------------------------------------------------------------
 * Auth middleware + a tiny error class so routes can throw
 * readable errors that bubble up to the central error handler.
 * ------------------------------------------------------------ */

import crypto from 'node:crypto';
import { stmts } from '../db.js';

/** Throw this from a route to send a clean JSON error response. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Generate a random opaque session token. */
export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware that requires a valid session token.
 * Frontend sends it as `Authorization: Bearer <token>`.
 * On success, attaches `req.user` (the user row) and `req.token`.
 */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return next(new ApiError(401, 'Missing Authorization header.'));

  const row = stmts.getToken.get(m[1]);
  if (!row) return next(new ApiError(401, 'Invalid or expired session. Please log in again.'));
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    stmts.deleteToken.run(m[1]);
    return next(new ApiError(401, 'Your session has expired. Please log in again.'));
  }

  const user = stmts.getUserById.get(row.user_id);
  if (!user) return next(new ApiError(401, 'Account no longer exists.'));

  req.user = user;
  req.token = m[1];
  next();
}

/**
 * Convenience wrapper so async route handlers don't need try/catch
 * boilerplate — errors bubble to Express's error middleware.
 */
export function handler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Strip a user row of internal fields before sending to the client.
 * Never send password_hash or timestamps the frontend doesn't use.
 */
export function publicUser(u) {
  if (!u) return null;
  return {
    id:            u.id,
    email:         u.email,
    firstName:     u.first_name,
    lastName:      u.last_name,
    countryCode:   u.country_code,
    phone:         u.phone,
    level:         u.level,
    weight:        u.weight,
    weightUnit:    u.weight_unit,
    height:        u.height,
    heightUnit:    u.height_unit,
    playsSport:    u.plays_sport,
    sportName:     u.sport_name,
    trainingGoal:  u.training_goal,
    plan:          u.plan,
    avatarUrl:     u.avatar_url
  };
}
