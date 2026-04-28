/*
 * SpotMe — profile routes
 * ------------------------------------------------------------
 * PATCH /api/profile          update profile fields
 *   body (any subset):
 *     firstName, lastName, weight, weightUnit, height, heightUnit,
 *     level, avatarUrl
 *   Email and password are deliberately NOT updatable here.
 *   (Password change would need an /api/profile/password endpoint
 *    with current-password confirmation — out of scope for v1.)
 *   Returns: { user }
 *
 * POST  /api/profile/upgrade  same as POST /api/subscription/checkout
 *   Returns: { url } redirect to Stripe Checkout when keys are configured;
 *   503 if payment is not configured.
 * ------------------------------------------------------------ */

import express from 'express';
import { stmts } from '../db.js';
import { ApiError, requireAuth, handler, publicUser } from './_shared.js';
import { createStripeCheckoutSession } from './subscription.js';

export const profileRoutes = express.Router();

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]{1,60}$/;
const LEVELS = new Set(['beginner', 'intermediate', 'pro']);

/* ---------- PATCH /api/profile ---------- */

profileRoutes.patch('/', requireAuth, handler((req, res) => {
  const u = req.user;
  const body = req.body || {};
  const errors = {};

  // Start from current values — any field omitted stays the same.
  const next = {
    id:          u.id,
    first_name:  u.first_name,
    last_name:   u.last_name,
    weight:      u.weight,
    weight_unit: u.weight_unit,
    height:      u.height,
    height_unit: u.height_unit,
    level:       u.level,
    avatar_url:  u.avatar_url
  };

  if (body.firstName !== undefined) {
    const v = String(body.firstName).trim();
    if (!NAME_RE.test(v)) errors.firstName = 'First name must be letters, spaces, hyphens, or apostrophes only.';
    else next.first_name = v;
  }
  if (body.lastName !== undefined) {
    const v = String(body.lastName).trim();
    if (!NAME_RE.test(v)) errors.lastName = 'Last name must be letters, spaces, hyphens, or apostrophes only.';
    else next.last_name = v;
  }
  if (body.firstName !== undefined && body.lastName !== undefined &&
      next.first_name.toLowerCase() === next.last_name.toLowerCase()) {
    errors.lastName = 'First and last name look the same — is that right?';
  }
  if (body.weight !== undefined) {
    const w = Number(body.weight);
    if (!isFinite(w) || w <= 0 || w > 500) errors.weight = 'Weight must be a positive number under 500.';
    else next.weight = w;
  }
  if (body.weightUnit !== undefined) {
    if (!['kg', 'lb'].includes(body.weightUnit)) errors.weightUnit = 'Invalid weight unit.';
    else next.weight_unit = body.weightUnit;
  }
  if (body.height !== undefined) {
    const h = Number(body.height);
    if (!isFinite(h) || h <= 0 || h > 300) errors.height = 'Height must be under 300 cm (or 10 ft).';
    else next.height = h;
  }
  if (body.heightUnit !== undefined) {
    if (!['cm', 'ft'].includes(body.heightUnit)) errors.heightUnit = 'Invalid height unit.';
    else next.height_unit = body.heightUnit;
  }
  if (body.level !== undefined) {
    if (!LEVELS.has(body.level)) errors.level = 'Invalid experience level.';
    else next.level = body.level;
  }
  if (body.avatarUrl !== undefined) {
    // Accept data: URLs up to 2 MB (after base64 overhead, actual image is ~1.5MB).
    // Bigger avatars shouldn't be in the DB — tell the frontend to resize.
    if (body.avatarUrl && !String(body.avatarUrl).startsWith('data:image/')) {
      errors.avatarUrl = 'Avatar must be an image.';
    } else if (body.avatarUrl && body.avatarUrl.length > 2_800_000) {
      errors.avatarUrl = 'Avatar is too large — please resize to under 2 MB.';
    } else {
      next.avatar_url = body.avatarUrl || null;
    }
  }

  if (Object.keys(errors).length) throw new ApiError(400, JSON.stringify({ fieldErrors: errors }));

  stmts.updateUserProfile.run(next);
  const fresh = stmts.getUserById.get(u.id);
  res.json({ user: publicUser(fresh) });
}));

/* ---------- POST /api/profile/upgrade ----------
 * Delegates to Stripe Checkout (same session as /api/subscription/checkout).
 * --------------------------------------------------------------- */

profileRoutes.post('/upgrade', requireAuth, handler(async (req, res) => {
  const { url } = await createStripeCheckoutSession(req);
  res.json({ url });
}));
