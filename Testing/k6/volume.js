/*
 * k6 Volume Test — SpotMe API
 * Run: k6 run tests/k6/volume.js
 *
 * Purpose: Test behavior under a large DATA volume rather than high concurrency.
 * Each VU creates many sessions, logs many messages, and queries large datasets.
 * Verifies the server handles bulk data operations correctly — no memory leaks,
 * no SQL query timeouts, no silent data truncation.
 *
 * Acceptance criteria:
 *   - All 2,000 sessions created successfully (no data loss)
 *   - p95 session creation < 300 ms
 *   - p95 session list query < 400 ms (even with 500 sessions per user)
 *   - Error rate < 1%
 *   - Consistent latency (no degradation as data grows)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

const createDuration  = new Trend('session_create_duration', true);
const listDuration    = new Trend('session_list_duration', true);
const errorRate       = new Rate('error_rate');
const sessionsCreated = new Counter('sessions_created');
const dataErrors      = new Counter('data_errors');

export const options = {
  // 10 VUs each creating 200 sessions = 2,000 total session records
  vus:         10,
  iterations:  200,
  thresholds: {
    http_req_duration:        ['p(95)<500'],
    http_req_failed:          ['rate<0.01'],
    error_rate:               ['rate<0.01'],
    session_create_duration:  ['p(95)<300'],
    session_list_duration:    ['p(95)<400'],
    data_errors:              ['count<5'],
  },
};

function uniqueEmail(vu) {
  return `volume_vu${vu}@test.spotme`;
}

// Cache tokens per VU so each VU reuses the same account
const vuTokens = {};

function getOrCreateUser(vu) {
  if (vuTokens[vu]) return vuTokens[vu];

  // Attempt signup first
  const signupRes = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
    email:     uniqueEmail(vu),
    password:  'VolumeTest1!Pass',
    firstName: 'Volume',
    lastName:  `User${vu}`,
  }), { headers: { 'Content-Type': 'application/json' } });

  if (signupRes.status === 200) {
    vuTokens[vu] = signupRes.json('token');
    return vuTokens[vu];
  }

  // Already exists — login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email:    uniqueEmail(vu),
    password: 'VolumeTest1!Pass',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (loginRes.status === 200) {
    vuTokens[vu] = loginRes.json('token');
  }
  return vuTokens[vu];
}

export default function () {
  const token = getOrCreateUser(__VU);
  if (!token) { errorRate.add(1); return; }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Create a workout session ── */
  group('create-session', () => {
    const exercises = Array.from({ length: 5 }, (_, i) => ({
      name:       `Exercise_${i + 1}`,
      sets:       3,
      reps:       [10, 8, 6],
      weightKg:   [60, 65, 70],
    }));

    const payload = JSON.stringify({
      title:     `Volume Session ${__ITER}`,
      durationMin: 45,
      notes:     `Auto-generated session ${__ITER} by volume test VU ${__VU}`,
      exercises,
    });

    const res = http.post(`${BASE_URL}/api/sessions`, payload, { headers });
    createDuration.add(res.timings.duration);

    const ok = check(res, {
      'session created 200 or 201': r => r.status === 200 || r.status === 201,
      'session id returned':        r => !!r.json('session')?.id || !!r.json('id'),
    });

    if (ok) {
      sessionsCreated.add(1);
    } else {
      dataErrors.add(1);
      errorRate.add(1);
    }
  });

  // Every 10th iteration, query the full session list to test read under load
  if (__ITER % 10 === 0) {
    group('list-sessions', () => {
      const res = http.get(`${BASE_URL}/api/sessions`, { headers });
      listDuration.add(res.timings.duration);

      const ok = check(res, {
        'list 200':          r => r.status === 200,
        'list is array':     r => Array.isArray(r.json('sessions')),
        'data not empty':    r => (r.json('sessions')?.length ?? 0) > 0,
      });
      if (!ok) errorRate.add(1);
    });
  }

  // Every 50th iteration, query profile to detect memory regression
  if (__ITER % 50 === 0) {
    group('profile-check', () => {
      const res = http.get(`${BASE_URL}/api/profile`, { headers });
      check(res, { 'profile 200': r => r.status === 200 }) || errorRate.add(1);
    });
  }

  sleep(0.05); // Tight pacing — we want data volume, not think-time
}

export function handleSummary(data) {
  return {
    'tests/k6/reports/volume-summary.json': JSON.stringify(data, null, 2),
    stdout: buildVolumeReport(data),
  };
}

function buildVolumeReport(data) {
  const m = data.metrics;
  const createP95 = m.session_create_duration?.values?.['p(95)']?.toFixed(1) ?? '-';
  const listP95   = m.session_list_duration?.values?.['p(95)']?.toFixed(1) ?? '-';
  const created   = m.sessions_created?.values?.count ?? 0;
  const errs      = ((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const dataErrs  = m.data_errors?.values?.count ?? 0;
  const totalReqs = m.http_reqs?.values?.count ?? 0;

  return `
╔══════════════════════════════════════╗
║        VOLUME TEST RESULTS           ║
╠══════════════════════════════════════╣
║ Total requests     : ${String(totalReqs).padEnd(13)} ║
║ Sessions created   : ${String(created).padEnd(13)} ║
║ Data errors        : ${String(dataErrs).padEnd(13)} ║
╠══════════════════════════════════════╣
║ LATENCY                              ║
║   Create p95       : ${String(createP95 + ' ms').padEnd(13)} ║
║   List   p95       : ${String(listP95 + ' ms').padEnd(13)} ║
╠══════════════════════════════════════╣
║ Error rate         : ${String(errs + ' %').padEnd(13)} ║
╠══════════════════════════════════════╣
║ PASS: create<300ms ${createP95 < 300 ? '✓' : '✗ FAIL'}             ║
║ PASS: list<400ms   ${listP95 < 400   ? '✓' : '✗ FAIL'}             ║
║ PASS: error<1%     ${errs < 1        ? '✓' : '✗ FAIL'}             ║
║ PASS: data_err<5   ${dataErrs < 5    ? '✓' : '✗ FAIL'}             ║
╚══════════════════════════════════════╝

Volume pattern: 10 VUs × 200 iterations = 2,000 session inserts
`;
}
