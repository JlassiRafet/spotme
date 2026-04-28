/*
 * SpotMe — Subscription routes (Stripe)
 * ------------------------------------------------------------
 * POST   /api/subscription/checkout  → create Stripe checkout session
 * POST   /api/subscription/portal    → create Stripe billing portal session
 * GET    /api/subscription/status    → current plan + billing info
 * POST   /api/subscription/cancel    → cancel at period end
 * POST   /api/webhook/stripe         → Stripe webhook handler (raw body)
 * ------------------------------------------------------------ */

import express from 'express';
import Stripe from 'stripe';
import { stmts } from '../db.js';
import { ApiError, requireAuth, handler, publicUser } from './_shared.js';

export const subscriptionRoutes = express.Router();
export const webhookRoutes      = express.Router();

/* ── Stripe client (lazy — only if keys are configured) ─────── */

let stripe;
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_REPLACE_ME') return null;
    stripe = new Stripe(key, { apiVersion: '2025-03-31.basil' });
  }
  return stripe;
}

const PRICE_ID = () => process.env.STRIPE_PRICE_ID || '';
const WEBHOOK_SECRET = () => process.env.STRIPE_WEBHOOK_SECRET || '';

const stripeConfigured = () => {
  const s = getStripe();
  const p = PRICE_ID();
  return s && p && p !== 'price_REPLACE_ME';
};

/* ── Helpers ─────────────────────────────────────────────────── */

function applySubscriptionUpdate(userId, sub) {
  const isPro    = sub.status === 'active' || sub.status === 'trialing';
  const endTs    = sub.current_period_end;         // unix seconds
  stmts.updateSubscription.run({
    id:                    userId,
    plan:                  isPro ? 'pro' : 'free',
    stripe_customer_id:    typeof sub.customer === 'string' ? sub.customer : null,
    stripe_subscription_id: sub.id,
    subscription_status:   sub.status,
    subscription_end:      endTs,
  });
}

function applyDowngrade(userId) {
  stmts.updateSubscription.run({
    id:                    userId,
    plan:                  'free',
    stripe_customer_id:    null,
    stripe_subscription_id: null,
    subscription_status:   'free',
    subscription_end:      null,
  });
}

/* ── GET /api/subscription/status ────────────────────────────── */

subscriptionRoutes.get('/status', requireAuth, handler((req, res) => {
  const u = req.user;
  res.json({
    plan:              u.plan              || 'free',
    status:            u.subscription_status || 'free',
    subscriptionEnd:   u.subscription_end  ? u.subscription_end * 1000 : null,
    stripeConfigured:  stripeConfigured(),
    cancelAtPeriodEnd: false,
  });
}));

/* ── POST /api/subscription/checkout ─────────────────────────── */

subscriptionRoutes.post('/checkout', requireAuth, handler(async (req, res) => {
  const s = getStripe();
  if (!s || !stripeConfigured()) {
    throw new ApiError(503, 'Payment is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to .env.');
  }

  const origin = req.headers.origin || `http://localhost:${process.env.PORT || 8787}`;
  // {CHECKOUT_SESSION_ID} is a Stripe template literal — it gets replaced with the real session id
  const successUrl = `${origin}/?page=plans&checkout=success&sid={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/?page=plans&checkout=canceled`;

  const params = {
    mode:                'subscription',
    line_items:          [{ price: PRICE_ID(), quantity: 1 }],
    success_url:         successUrl,
    cancel_url:          cancelUrl,
    allow_promotion_codes: true,
    subscription_data:   { metadata: { spotme_user_id: String(req.user.id) } },
    metadata:            { spotme_user_id: String(req.user.id) },
  };

  // Attach to existing Stripe customer if we have one
  if (req.user.stripe_customer_id) {
    params.customer = req.user.stripe_customer_id;
  } else {
    params.customer_email = req.user.email;
  }

  const session = await s.checkout.sessions.create(params);
  res.json({ url: session.url });
}));

/* ── POST /api/subscription/verify ───────────────────────────── */
// Called after Stripe redirects with ?sid=cs_xxx — looks up the session
// and immediately upgrades the user without waiting for a webhook.

subscriptionRoutes.post('/verify', requireAuth, handler(async (req, res) => {
  const s = getStripe();
  if (!s) return res.json({ ok: false, plan: req.user.plan || 'free' });

  const { sessionId } = req.body;
  if (!sessionId) return res.json({ ok: false, plan: req.user.plan || 'free' });

  let session;
  try {
    session = await s.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
  } catch (e) {
    console.error('[stripe] verify session error:', e.message);
    return res.json({ ok: false, plan: req.user.plan || 'free' });
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return res.json({ ok: false, plan: 'free' });
  }

  const sub = session.subscription;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (sub && typeof sub === 'object') {
    stmts.updateSubscription.run({
      id:                    req.user.id,
      plan:                  'pro',
      stripe_customer_id:    customerId || null,
      stripe_subscription_id: sub.id,
      subscription_status:   sub.status,
      subscription_end:      sub.current_period_end,
    });
  } else {
    // Subscription is just an ID string — do a minimal update
    stmts.updateSubscription.run({
      id:                    req.user.id,
      plan:                  'pro',
      stripe_customer_id:    customerId || null,
      stripe_subscription_id: typeof sub === 'string' ? sub : null,
      subscription_status:   'active',
      subscription_end:      null,
    });
  }

  // Return fresh user profile
  const updated = stmts.getUserById.get(req.user.id);
  const { publicUser } = await import('./_shared.js');
  res.json({ ok: true, plan: 'pro', user: publicUser(updated) });
}));

/* ── POST /api/subscription/portal ───────────────────────────── */

subscriptionRoutes.post('/portal', requireAuth, handler(async (req, res) => {
  const s = getStripe();
  if (!s) throw new ApiError(503, 'Payment not configured.');

  if (!req.user.stripe_customer_id) {
    throw new ApiError(400, 'No billing account found. Please upgrade first.');
  }

  const origin    = req.headers.origin || `http://localhost:${process.env.PORT || 8787}`;
  const returnUrl = `${origin}/?page=plans`;

  const portal = await s.billingPortal.sessions.create({
    customer:   req.user.stripe_customer_id,
    return_url: returnUrl,
  });
  res.json({ url: portal.url });
}));

/* ── POST /api/subscription/cancel ───────────────────────────── */

subscriptionRoutes.post('/cancel', requireAuth, handler(async (req, res) => {
  const s = getStripe();
  if (!s) throw new ApiError(503, 'Payment not configured.');

  if (!req.user.stripe_subscription_id) {
    throw new ApiError(400, 'No active subscription to cancel.');
  }

  // Cancel at period end — user keeps Pro until billing date
  const sub = await s.subscriptions.update(req.user.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  res.json({
    ok: true,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    subscriptionEnd:   sub.current_period_end * 1000,
  });
}));

/* ── POST /api/webhook/stripe ────────────────────────────────── */

webhookRoutes.post('/stripe', handler(async (req, res) => {
  const s = getStripe();
  if (!s) return res.json({ received: true });

  const sig     = req.headers['stripe-signature'];
  const secret  = WEBHOOK_SECRET();

  let event;
  try {
    event = (secret && secret !== 'whsec_REPLACE_ME')
      ? s.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body.toString());   // dev fallback: trust raw JSON
  } catch (err) {
    console.error('[stripe] Webhook signature error:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed.' });
  }

  console.log(`[stripe] Event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId  = Number(session.metadata?.spotme_user_id);
      if (!userId) break;

      // Retrieve the full subscription object
      const sub = await s.subscriptions.retrieve(session.subscription);
      applySubscriptionUpdate(userId, sub);
      // Also store customer ID from checkout
      const user = stmts.getUserById.get(userId);
      if (user) {
        stmts.updateSubscription.run({
          id:                    userId,
          plan:                  'pro',
          stripe_customer_id:    session.customer,
          stripe_subscription_id: sub.id,
          subscription_status:   sub.status,
          subscription_end:      sub.current_period_end,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub  = event.data.object;
      const user = stmts.getUserByStripeSubscription.get(sub.id)
                || stmts.getUserByStripeCustomer.get(typeof sub.customer === 'string' ? sub.customer : '');
      if (user) applySubscriptionUpdate(user.id, sub);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub  = event.data.object;
      const user = stmts.getUserByStripeSubscription.get(sub.id)
                || stmts.getUserByStripeCustomer.get(typeof sub.customer === 'string' ? sub.customer : '');
      if (user) applyDowngrade(user.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const user    = stmts.getUserByStripeCustomer.get(
        typeof invoice.customer === 'string' ? invoice.customer : ''
      );
      if (user) {
        stmts.updateSubscription.run({
          id:                    user.id,
          plan:                  user.plan,
          stripe_customer_id:    user.stripe_customer_id,
          stripe_subscription_id: user.stripe_subscription_id,
          subscription_status:   'past_due',
          subscription_end:      user.subscription_end,
        });
      }
      break;
    }

    default:
      break;
  }

  res.json({ received: true });
}));
