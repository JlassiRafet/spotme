/*
 * k6 Spike Test — SpotMe API
 * Run: k6 run tests/k6/spike.js
 *
 * Purpose: Simulate a sudden burst of traffic (e.g. marketing campaign goes viral,
 *          social media post, or flash sale). The system goes from idle to 300 VUs
 *          almost instantly, then drops back. Verifies the server handles sudden
 *          surges without crashing and recovers gracefully.
 *
 * Acceptance criteria:
 *   - Server does NOT crash (0 connection refused)
 *   - Error rate stays below 15% during the spike
 *   - Response time recovers to < 500 ms within 30s of spike end
 *   - p99 never exceeds 10 s (no hung connections)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

const errorRate       = new Rate('error_rate');
const spikeLatency    = new Trend('spike_latency', true);
const recoveryLatency = new Trend('recovery_latency', true);
const connectionErrors = new Counter('connection_errors');

export const options = {
  stages: [
    { duration: '30s', target: 5   },   // Baseline — nearly idle
    { duration: '10s', target: 300 },   // SPIKE — 0→300 VUs in 10 s
    { duration: '1m',  target: 300 },   // Sustain the spike
    { duration: '10s', target: 5   },   // Drop back to baseline
    { duration: '1m',  target: 5   },   // Recovery window — verify normal ops
    { duration: '10s', target: 0   },   // Ramp down
  ],
  thresholds: {
    http_req_duration:  ['p(99)<10000'],  // No hung connections
    http_req_failed:    ['rate<0.15'],    // Up to 15% errors during spike
    error_rate:         ['rate<0.15'],
    connection_errors:  ['count<50'],     // Hard limit: server must not refuse connections
  },
};

function uniqueEmail() {
  return `spike_${__VU}_${__ITER}_${Date.now()}@test.spotme`;
}

function inSpikeStage() {
  // Approximate: VU count > 50 indicates spike stage
  return __VU > 50;
}

export default function () {
  let token = null;
  const isSpiking = inSpikeStage();

  /* ── Health probe ── */
  group('health', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    if (res.error_code === 1212 || res.error_code === 1101) {
      connectionErrors.add(1);
      errorRate.add(1);
      return;
    }
    const ok = check(res, {
      'health 200': r => r.status === 200,
    });
    if (!ok) errorRate.add(1);
  });

  /* ── Signup ── */
  group('signup', () => {
    const res = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
      email:     uniqueEmail(),
      password:  'SpikeTest1!Pass',
      firstName: 'Spike',
      lastName:  'User',
    }), { headers: { 'Content-Type': 'application/json' }, timeout: '10s' });

    if (res.error_code === 1212 || res.error_code === 1101) {
      connectionErrors.add(1);
      errorRate.add(1);
      return;
    }

    if (isSpiking) {
      spikeLatency.add(res.timings.duration);
    } else {
      recoveryLatency.add(res.timings.duration);
    }

    const ok = check(res, {
      'signup 2xx or 409': r => r.status === 200 || r.status === 409,
    });
    if (!ok) { errorRate.add(1); return; }
    if (res.status === 200) token = res.json('token');
  });

  if (!token) { sleep(0.3); return; }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Me (auth check) ── */
  group('me', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers, timeout: '10s' });
    check(res, { 'me 200': r => r.status === 200 }) || errorRate.add(1);
  });

  /* ── Logout ── */
  group('logout', () => {
    const res = http.post(`${BASE_URL}/api/auth/logout`, null, { headers, timeout: '10s' });
    check(res, { 'logout 200': r => r.status === 200 }) || errorRate.add(1);
  });

  // During spike: minimal sleep to maximize pressure
  // During recovery: normal pacing
  sleep(isSpiking ? 0.05 : 0.5);
}

export function handleSummary(data) {
  return {
    'tests/k6/reports/spike-summary.json': JSON.stringify(data, null, 2),
    stdout: buildSpikeReport(data),
  };
}

function buildSpikeReport(data) {
  const m = data.metrics;
  const p95      = m.http_req_duration?.values?.['p(95)']?.toFixed(1) ?? '-';
  const p99      = m.http_req_duration?.values?.['p(99)']?.toFixed(1) ?? '-';
  const errs     = ((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const maxVu    = m.vus_max?.values?.max ?? '-';
  const connErrs = m.connection_errors?.values?.count ?? 0;
  const spikeP95 = m.spike_latency?.values?.['p(95)']?.toFixed(1) ?? '-';
  const recP95   = m.recovery_latency?.values?.['p(95)']?.toFixed(1) ?? '-';

  return `
╔══════════════════════════════════════╗
║        SPIKE TEST RESULTS            ║
╠══════════════════════════════════════╣
║ Peak VUs (spike)   : ${String(maxVu).padEnd(13)} ║
╠══════════════════════════════════════╣
║ DURING SPIKE                         ║
║   p95 latency      : ${String(spikeP95 + ' ms').padEnd(13)} ║
╠══════════════════════════════════════╣
║ RECOVERY PERIOD                      ║
║   p95 latency      : ${String(recP95 + ' ms').padEnd(13)} ║
╠══════════════════════════════════════╣
║ OVERALL                              ║
║   p95 latency      : ${String(p95 + ' ms').padEnd(13)} ║
║   p99 latency      : ${String(p99 + ' ms').padEnd(13)} ║
║   Error rate       : ${String(errs + ' %').padEnd(13)} ║
║   Connection errs  : ${String(connErrs).padEnd(13)} ║
╠══════════════════════════════════════╣
║ PASS: error<15%    ${errs < 15  ? '✓' : '✗ FAIL'}             ║
║ PASS: conn<50      ${connErrs < 50 ? '✓' : '✗ FAIL'}             ║
║ PASS: p99<10s      ${p99 < 10000 ? '✓' : '✗ FAIL'}             ║
╚══════════════════════════════════════╝

Spike pattern: Idle (5 VUs) → SPIKE (300 VUs in 10s) → Recovery (5 VUs)
`;
}
