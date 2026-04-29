/*
 * k6 Endurance (Soak) Test — SpotMe API
 * Run: k6 run tests/k6/endurance.js
 *
 * Purpose: Run the system under moderate but sustained load for an extended
 * period to uncover memory leaks, connection pool exhaustion, SQLite WAL growth,
 * and slow performance degradation that only appears over time.
 *
 * Duration: 30 minutes at 20 concurrent users
 * (For a full soak use --env DURATION=2h --env TARGET_VUS=20)
 *
 * Acceptance criteria:
 *   - p95 latency at end of test ≤ 150% of p95 at start (no degradation)
 *   - Error rate stays below 0.5% throughout
 *   - No memory leak signal (proxy: latency trend must be stable)
 *   - SQLite file growth is bounded (manual check after test)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Gauge } from 'k6/metrics';

const BASE_URL   = __ENV.BASE_URL    || 'http://localhost:8787';
const DURATION   = __ENV.DURATION    || '30m';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '20');

const errorRate        = new Rate('error_rate');
const authLatency      = new Trend('auth_latency',     true);
const sessionLatency   = new Trend('session_latency',  true);
const profileLatency   = new Trend('profile_latency',  true);
const latencyDrift     = new Gauge('latency_drift_pct');  // rough degradation signal

// Rolling window for degradation detection
const windowSize = 100;
let   recentDurations = [];
let   baselineP95 = null;

export const options = {
  stages: [
    { duration: '2m',    target: TARGET_VUS },  // Warm-up ramp
    { duration: DURATION, target: TARGET_VUS }, // Sustained soak
    { duration: '2m',    target: 0 },           // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.005'],
    error_rate:        ['rate<0.005'],
    auth_latency:      ['p(95)<150'],
    session_latency:   ['p(95)<300'],
    profile_latency:   ['p(95)<200'],
  },
};

// VU-local state — each VU keeps its token alive for the whole test
let vuToken = null;
let vuEmail = null;

function ensureToken() {
  if (vuToken) return vuToken;

  vuEmail = `endurance_vu${__VU}_${Date.now()}@test.spotme`;

  const res = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
    email:     vuEmail,
    password:  'EnduranceTest1!',
    firstName: 'Soak',
    lastName:  `VU${__VU}`,
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status === 200) {
    vuToken = res.json('token');
  }
  return vuToken;
}

function trackDrift(duration) {
  recentDurations.push(duration);
  if (recentDurations.length > windowSize) recentDurations.shift();

  const sorted = [...recentDurations].sort((a, b) => a - b);
  const currentP95 = sorted[Math.floor(sorted.length * 0.95)];

  if (baselineP95 === null && recentDurations.length === windowSize) {
    baselineP95 = currentP95;
  }
  if (baselineP95 !== null && baselineP95 > 0) {
    const drift = ((currentP95 - baselineP95) / baselineP95) * 100;
    latencyDrift.add(Math.max(0, drift));
  }
}

export default function () {
  const token = ensureToken();
  if (!token) { errorRate.add(1); sleep(1); return; }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Auth check: GET /api/auth/me ── */
  group('auth-check', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers });
    authLatency.add(res.timings.duration);
    trackDrift(res.timings.duration);

    const ok = check(res, {
      'me 200':            r => r.status === 200,
      'me has email':      r => typeof r.json('user.email') === 'string',
    });
    if (!ok) {
      errorRate.add(1);
      // Token may have expired — clear and re-auth on next iteration
      if (res.status === 401) vuToken = null;
    }
  });

  sleep(0.2);

  /* ── Session create ── */
  group('session-create', () => {
    const res = http.post(`${BASE_URL}/api/sessions`, JSON.stringify({
      title:       `Soak session ${__ITER}`,
      durationMin: 30,
      exercises:   [{ name: 'Squat', sets: 3, reps: [10, 10, 8], weightKg: [80, 80, 85] }],
    }), { headers });
    sessionLatency.add(res.timings.duration);
    check(res, {
      'session 200/201': r => r.status === 200 || r.status === 201,
    }) || errorRate.add(1);
  });

  sleep(0.3);

  /* ── Session list ── */
  group('session-list', () => {
    const res = http.get(`${BASE_URL}/api/sessions`, { headers });
    check(res, {
      'list 200':      r => r.status === 200,
      'list is array': r => Array.isArray(r.json('sessions')),
    }) || errorRate.add(1);
  });

  sleep(0.2);

  /* ── Profile read ── */
  group('profile-read', () => {
    const res = http.get(`${BASE_URL}/api/profile`, { headers });
    profileLatency.add(res.timings.duration);
    check(res, { 'profile 200': r => r.status === 200 }) || errorRate.add(1);
  });

  // Realistic think-time between user actions
  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  return {
    'tests/k6/reports/endurance-summary.json': JSON.stringify(data, null, 2),
    stdout: buildEnduranceReport(data),
  };
}

function buildEnduranceReport(data) {
  const m = data.metrics;
  const p50       = m.http_req_duration?.values?.['p(50)']?.toFixed(1) ?? '-';
  const p95       = m.http_req_duration?.values?.['p(95)']?.toFixed(1) ?? '-';
  const p99       = m.http_req_duration?.values?.['p(99)']?.toFixed(1) ?? '-';
  const errs      = ((m.http_req_failed?.values?.rate || 0) * 100).toFixed(3);
  const totalReqs = m.http_reqs?.values?.count ?? 0;
  const drift     = m.latency_drift_pct?.values?.value?.toFixed(1) ?? '-';
  const authP95   = m.auth_latency?.values?.['p(95)']?.toFixed(1) ?? '-';
  const sessP95   = m.session_latency?.values?.['p(95)']?.toFixed(1) ?? '-';
  const profP95   = m.profile_latency?.values?.['p(95)']?.toFixed(1) ?? '-';
  const maxVu     = m.vus_max?.values?.max ?? '-';

  return `
╔══════════════════════════════════════════╗
║       ENDURANCE (SOAK) TEST RESULTS      ║
╠══════════════════════════════════════════╣
║ Duration           : ${String(DURATION).padEnd(18)} ║
║ VUs                : ${String(maxVu).padEnd(18)} ║
║ Total requests     : ${String(totalReqs).padEnd(18)} ║
╠══════════════════════════════════════════╣
║ OVERALL LATENCY                          ║
║   p50              : ${String(p50 + ' ms').padEnd(18)} ║
║   p95              : ${String(p95 + ' ms').padEnd(18)} ║
║   p99              : ${String(p99 + ' ms').padEnd(18)} ║
╠══════════════════════════════════════════╣
║ ENDPOINT BREAKDOWN (p95)                 ║
║   Auth (/me)       : ${String(authP95 + ' ms').padEnd(18)} ║
║   Session create   : ${String(sessP95 + ' ms').padEnd(18)} ║
║   Profile read     : ${String(profP95 + ' ms').padEnd(18)} ║
╠══════════════════════════════════════════╣
║ STABILITY                                ║
║   Error rate       : ${String(errs + ' %').padEnd(18)} ║
║   Latency drift    : ${String(drift + ' %').padEnd(18)} ║
╠══════════════════════════════════════════╣
║ PASS: error<0.5%   ${errs < 0.5      ? '✓' : '✗ FAIL'}               ║
║ PASS: p95<500ms    ${p95 < 500       ? '✓' : '✗ FAIL'}               ║
║ PASS: drift<50%    ${drift < 50      ? '✓' : '✗ FAIL'}               ║
╚══════════════════════════════════════════╝

Memory leak check: compare SQLite file size before vs after.
Recommended: restart server, re-run, compare p95 at minute 1 vs last minute.
`;
}
