/*
 * k6 Smoke Test — SpotMe API
 * Run: k6 run tests/k6/smoke.js
 *
 * Purpose: Quick sanity check — 1 VU, 10 iterations.
 * Verifies critical paths work before heavier load tests.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

const authDuration    = new Trend('auth_duration', true);
const sessionDuration = new Trend('session_duration', true);
const errorRate       = new Rate('error_rate');

export const options = {
  vus:        1,
  iterations: 10,
  thresholds: {
    http_req_failed:   ['rate<0.01'],        // 0% errors allowed in smoke
    http_req_duration: ['p(95)<500'],        // all requests under 500 ms
    error_rate:        ['rate<0.01'],
  },
};

function uniqueEmail() {
  return `smoke_${Date.now()}_${Math.random().toString(36).slice(2)}@test.spotme`;
}

export default function () {
  let token = null;

  /* ── Health check ── */
  group('health', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health 200': r => r.status === 200,
      'health ok':  r => r.json('ok') === true,
    }) || errorRate.add(1);
  });

  /* ── Sign up ── */
  group('signup', () => {
    const res = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
      email:     uniqueEmail(),
      password:  'SmokePas1!safe',
      firstName: 'Smoke',
      lastName:  'Test',
    }), { headers: { 'Content-Type': 'application/json' } });

    authDuration.add(res.timings.duration);

    const ok = check(res, {
      'signup 200':    r => r.status === 200,
      'token present': r => r.json('token') !== undefined,
    });
    if (!ok) { errorRate.add(1); return; }
    token = res.json('token');
  });

  if (!token) return;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Auth: /me ── */
  group('me', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers });
    const ok = check(res, {
      'me 200':          r => r.status === 200,
      'me returns user': r => r.json('user.email') !== null,
    });
    if (!ok) errorRate.add(1);
  });

  /* ── Sessions: list (empty) ── */
  group('sessions-list', () => {
    const res = http.get(`${BASE_URL}/api/sessions`, { headers });
    sessionDuration.add(res.timings.duration);
    const ok = check(res, {
      'sessions 200':         r => r.status === 200,
      'sessions is array':    r => Array.isArray(r.json('sessions')),
    });
    if (!ok) errorRate.add(1);
  });

  /* ── Profile update ── */
  group('profile-patch', () => {
    const res = http.patch(`${BASE_URL}/api/profile`,
      JSON.stringify({ weight: 75, level: 'intermediate' }),
      { headers });
    const ok = check(res, {
      'profile 200': r => r.status === 200,
    });
    if (!ok) errorRate.add(1);
  });

  /* ── Upgrade (stub: expect 501) ── */
  group('upgrade-stub', () => {
    const res = http.post(`${BASE_URL}/api/profile/upgrade`, null, { headers });
    check(res, {
      'upgrade 501 (expected)': r => r.status === 501,
    });
  });

  /* ── Logout ── */
  group('logout', () => {
    const res = http.post(`${BASE_URL}/api/auth/logout`, null, { headers });
    check(res, {
      'logout 200': r => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    'tests/k6/reports/smoke-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const { metrics } = data;
  const p95 = metrics.http_req_duration?.values?.['p(95)']?.toFixed(1) ?? 'n/a';
  const errs = metrics.http_req_failed?.values?.rate?.toFixed(4) ?? 'n/a';
  return `\n=== SMOKE SUMMARY ===\np95 latency: ${p95} ms\nError rate:  ${errs}\n`;
}
