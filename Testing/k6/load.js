/*
 * k6 Load Test — SpotMe API
 * Run: k6 run tests/k6/load.js
 *
 * Simulates expected production load: 50 concurrent users over 5 minutes.
 * Scenario: signup → me → list sessions → profile update → logout
 *
 * Acceptance criteria (from test plan):
 *   - p95 response time < 200 ms
 *   - p99 response time < 500 ms
 *   - Error rate < 1%
 *   - Throughput > 100 req/s
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

const signupDuration  = new Trend('signup_duration', true);
const authDuration    = new Trend('auth_duration', true);
const profileDuration = new Trend('profile_duration', true);
const errorRate       = new Rate('error_rate');
const signupErrors    = new Counter('signup_errors');
const authErrors      = new Counter('auth_errors');

export const options = {
  stages: [
    { duration: '30s', target: 10  },   // Ramp-up: 0 → 10 VUs
    { duration: '30s', target: 50  },   // Ramp-up: 10 → 50 VUs
    { duration: '3m',  target: 50  },   // Steady state: 50 VUs
    { duration: '30s', target: 20  },   // Cool-down: 50 → 20 VUs
    { duration: '30s', target: 0   },   // Ramp-down: 20 → 0 VUs
  ],
  thresholds: {
    http_req_duration:              ['p(95)<200', 'p(99)<500'],
    http_req_failed:                ['rate<0.01'],
    error_rate:                     ['rate<0.01'],
    signup_duration:                ['p(95)<300'],
    auth_duration:                  ['p(95)<100'],
    profile_duration:               ['p(95)<150'],
  },
};

function uniqueEmail() {
  return `load_${__VU}_${__ITER}_${Date.now()}@test.spotme`;
}

export default function () {
  let token = null;

  /* ── Sign up ── */
  group('signup', () => {
    const payload = JSON.stringify({
      email:     uniqueEmail(),
      password:  'LoadTest1!Pass',
      firstName: 'Load',
      lastName:  'User',
    });
    const res = http.post(`${BASE_URL}/api/auth/signup`, payload,
      { headers: { 'Content-Type': 'application/json' } });

    signupDuration.add(res.timings.duration);

    const ok = check(res, {
      'signup 200':    r => r.status === 200,
      'token returned': r => typeof r.json('token') === 'string',
    });

    if (!ok) { signupErrors.add(1); errorRate.add(1); return; }
    token = res.json('token');
  });

  if (!token) { sleep(1); return; }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  sleep(0.1);

  /* ── Auth check ── */
  group('me', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers });
    authDuration.add(res.timings.duration);
    const ok = check(res, {
      'me 200':   r => r.status === 200,
      'me email': r => typeof r.json('user.email') === 'string',
    });
    if (!ok) { authErrors.add(1); errorRate.add(1); }
  });

  sleep(0.2);

  /* ── List sessions ── */
  group('sessions', () => {
    const res = http.get(`${BASE_URL}/api/sessions`, { headers });
    check(res, {
      'sessions 200':  r => r.status === 200,
      'sessions array': r => Array.isArray(r.json('sessions')),
    }) || errorRate.add(1);
  });

  sleep(0.1);

  /* ── Profile update ── */
  group('profile', () => {
    const res = http.patch(`${BASE_URL}/api/profile`,
      JSON.stringify({ weight: 70 + (__VU % 50), level: 'intermediate' }),
      { headers });
    profileDuration.add(res.timings.duration);
    check(res, { 'profile 200': r => r.status === 200 }) || errorRate.add(1);
  });

  sleep(0.3);

  /* ── Logout ── */
  group('logout', () => {
    const res = http.post(`${BASE_URL}/api/auth/logout`, null, { headers });
    check(res, { 'logout 200': r => r.status === 200 }) || errorRate.add(1);
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'tests/k6/reports/load-summary.json': JSON.stringify(data, null, 2),
    stdout: buildReport(data),
  };
}

function buildReport(data) {
  const m    = data.metrics;
  const p95  = m.http_req_duration?.values?.['p(95)']?.toFixed(1) ?? '-';
  const p99  = m.http_req_duration?.values?.['p(99)']?.toFixed(1) ?? '-';
  const rps  = m.http_reqs?.values?.rate?.toFixed(1) ?? '-';
  const errs = ((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const vus  = m.vus_max?.values?.max ?? '-';

  return `
╔══════════════════════════════╗
║   LOAD TEST RESULTS          ║
╠══════════════════════════════╣
║ Peak VUs       : ${String(vus).padEnd(10)} ║
║ Throughput     : ${String(rps + ' req/s').padEnd(10)} ║
║ p95 latency    : ${String(p95 + ' ms').padEnd(10)} ║
║ p99 latency    : ${String(p99 + ' ms').padEnd(10)} ║
║ Error rate     : ${String(errs + ' %').padEnd(10)} ║
╠══════════════════════════════╣
║ PASS: p95<200ms ${p95 < 200 ? '✓' : '✗'}            ║
║ PASS: error<1%  ${errs < 1  ? '✓' : '✗'}            ║
╚══════════════════════════════╝
`;
}
