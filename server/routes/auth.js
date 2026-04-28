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
import crypto from 'crypto';
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
  } else if (body.password.length > 72) {
    errors.password = 'Password is too long (max 72 characters).';
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
  // Always run bcrypt even on a missing user (or OAuth-only user with no password_hash)
  // so timing doesn't reveal whether the email exists.
  const hash = (user && user.password_hash) ? user.password_hash : '$2a$11$0000000000000000000000000000000000000000000000000000';
  const ok = await bcrypt.compare(password, hash);
  // OAuth-only accounts have empty password_hash — block password login for them
  if (user && !user.password_hash && ok === false) {
    throw new ApiError(401, 'This account uses Google Sign-In. Use the Google button to sign in.');
  }

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

/* ---------- DELETE /api/auth/account ---------- */

authRoutes.delete('/account', requireAuth, handler((req, res) => {
  stmts.deleteUser.run(req.user.id);
  res.json({ ok: true });
}));

/* ---------- GET /api/auth/google (initiate OAuth) ---------- */

/* In-memory state store — keyed by random hex, expires in 10 minutes */
const oauthStates = new Map();

authRoutes.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'REPLACE_ME') {
    return res.status(503).send('Google Sign-In is not configured on this server.');
  }
  const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 8787}`;
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${base}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
    state
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/* ---------- GET /api/auth/google/callback ---------- */

authRoutes.get('/google/callback', async (req, res) => {
  const base     = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 8787}`;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret   = process.env.GOOGLE_CLIENT_SECRET;
  const { code, error, state } = req.query;

  if (error || !code) return res.redirect(`${base}/?auth_error=cancelled`);

  // Validate CSRF state
  const expiry = oauthStates.get(state);
  oauthStates.delete(state);
  if (!state || !expiry || Date.now() > expiry) {
    return res.redirect(`${base}/?auth_error=invalid_state`);
  }

  try {
    // Exchange auth code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: secret,
        redirect_uri:  `${base}/api/auth/google/callback`,
        grant_type:    'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(`${base}/?auth_error=token_failed`);

    // Get Google user info
    const userRes  = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const gUser = await userRes.json();
    if (!gUser.email) return res.redirect(`${base}/?auth_error=no_email`);

    const email = gUser.email.toLowerCase();

    // Find or create local user
    let user = stmts.getUserByEmail.get(email);
    if (!user) {
      const nameParts  = (gUser.name || '').split(' ');
      const firstName  = gUser.given_name  || nameParts[0]               || 'User';
      const lastName   = gUser.family_name || nameParts.slice(1).join(' ')|| '';
      const info = stmts.insertUser.run({
        email, password_hash: '',
        first_name: firstName, last_name: lastName,
        country_code: null, phone: null, level: null,
        weight: null, weight_unit: null, height: null, height_unit: null,
        plays_sport: null, sport_name: null, training_goal: null
      });
      user = stmts.getUserById.get(info.lastInsertRowid);
    }

    const token   = newToken();
    const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    stmts.insertToken.run(token, user.id, expires);

    res.redirect(`${base}/?token=${token}`);
  } catch (err) {
    console.error('[spotme] Google OAuth error:', err);
    res.redirect(`${base}/?auth_error=server_error`);
  }
});
