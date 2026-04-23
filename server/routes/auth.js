/*
 * SpotMe — auth routes
 * ------------------------------------------------------------
 * POST /api/auth/signup   { email, password, firstName, lastName, ...profile }
 *                          → { token, user }
 * POST /api/auth/login    { email, password }
 *                          → { token, user }
 * POST /api/auth/logout   (requires Bearer token)
 *                          → { ok: true }
 * GET  /api/auth/me       (requires Bearer token)
 *                          → { user }
 *
 * Tokens are random 32-byte hex strings with a 30-day expiry.
 * Passwords are bcrypt-hashed with cost 11.
 * ------------------------------------------------------------ */

import express from 'express';
import bcrypt from 'bcryptjs';
import { stmts } from '../db.js';
import { ApiError, newToken, requireAuth, handler, publicUser } from './_shared.js';

export const authRoutes = express.Router();

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/* ---------- validation ---------- */

const NAME_RE  = /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]{1,60}$/;     // letters, spaces, hyphens, apostrophes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEVELS   = new Set(['beginner', 'intermediate', 'pro']);

function validateSignup(body) {
  const errors = {};

  if (!body.firstName || !NAME_RE.test(body.firstName.trim())) {
    errors.firstName = 'First name must be letters, spaces, hyphens, or apostrophes only.';
  }
  if (!body.lastName || !NAME_RE.test(body.lastName.trim())) {
    errors.lastName = 'Last name must be letters, spaces, hyphens, or apostrophes only.';
  }
  if (body.firstName && body.lastName &&
      body.firstName.trim().toLowerCase() === body.lastName.trim().toLowerCase()) {
    errors.lastName = 'First and last name look the same — is that right?';
  }
  if (!body.email || !EMAIL_RE.test(body.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!body.password || body.password.length < 12) {
    errors.password = 'Password must be at least 12 characters.';
  } else if (!/[a-z]/.test(body.password) || !/[A-Z]/.test(body.password) ||
             !/[0-9]/.test(body.password) || !/[^A-Za-z0-9]/.test(body.password)) {
    errors.password = 'Password needs lowercase, uppercase, a number, and a symbol.';
  }
  if (body.level && !LEVELS.has(body.level)) {
    errors.level = 'Invalid experience level.';
  }
  if (body.weight != null) {
    const w = Number(body.weight);
    if (!isFinite(w) || w <= 0 || w > 500) {
      errors.weight = 'Weight must be a positive number under 500.';
    }
  }
  if (body.height != null) {
    const h = Number(body.height);
    if (!isFinite(h) || h <= 0 || h > 300) {
      errors.height = 'Height must be a positive number under 300 cm (or 10 ft).';
    }
  }

  return Object.keys(errors).length ? errors : null;
}

/* ---------- POST /api/auth/signup ---------- */

authRoutes.post('/signup', handler(async (req, res) => {
  const errors = validateSignup(req.body);
  if (errors) throw new ApiError(400, JSON.stringify({ fieldErrors: errors }));

  const email = req.body.email.trim().toLowerCase();
  if (stmts.getUserByEmail.get(email)) {
    throw new ApiError(409, 'An account with that email already exists.');
  }

  const password_hash = await bcrypt.hash(req.body.password, 11);

  const info = stmts.insertUser.run({
    email,
    password_hash,
    first_name:    req.body.firstName.trim(),
    last_name:     req.body.lastName.trim(),
    country_code:  req.body.countryCode || null,
    phone:         req.body.phone || null,
    level:         req.body.level || null,
    weight:        req.body.weight != null ? Number(req.body.weight) : null,
    weight_unit:   req.body.weightUnit || null,
    height:        req.body.height != null ? Number(req.body.height) : null,
    height_unit:   req.body.heightUnit || null,
    plays_sport:   req.body.playsSport || null,
    sport_name:    req.body.sportName || null,
    training_goal: req.body.trainingGoal || null
  });

  const user = stmts.getUserById.get(info.lastInsertRowid);
  const token = newToken();
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  stmts.insertToken.run(token, user.id, expires);

  res.json({ token, user: publicUser(user) });
}));

/* ---------- POST /api/auth/login ---------- */

authRoutes.post('/login', handler(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!EMAIL_RE.test(email) || !password) {
    throw new ApiError(400, 'Enter your email and password.');
  }

  const user = stmts.getUserByEmail.get(email);
  // Always run bcrypt even on a missing user, so timing doesn't leak whether
  // an email exists. Compare against a dummy hash if user is null.
  const hash = user ? user.password_hash : '$2a$11$0000000000000000000000000000000000000000000000000000';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) throw new ApiError(401, 'Email or password is incorrect.');

  const token = newToken();
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  stmts.insertToken.run(token, user.id, expires);

  res.json({ token, user: publicUser(user) });
}));

/* ---------- POST /api/auth/logout ---------- */

authRoutes.post('/logout', requireAuth, handler((req, res) => {
  stmts.deleteToken.run(req.token);
  res.json({ ok: true });
}));

/* ---------- GET /api/auth/me ---------- */

authRoutes.get('/me', requireAuth, handler((req, res) => {
  res.json({ user: publicUser(req.user) });
}));
