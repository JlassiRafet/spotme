/*
 * k6 Stress Test — SpotMe API
 * Run: k6 run tests/k6/stress.js
 *
 * Pushes the server beyond normal capacity to find the breaking point.
 * Uses a spike scenario: rapid ramp-up to 200 VUs, hold, then cool-down.
 *
 * Metrics to capture:
 *   - Response Time (p50, p95, p99)
 *   - Throughput (req/s)
 *   - CPU & memory tracked externally (htop / Task Manager)
 *   - Error rate at each stage
 *   - Scalability threshold (VU count where errors first appear)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Gauge } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

const errorRate       = new Rate('error_rate');
const signupLatency   = new Trend('signup_latency', true);
const authLatency     = new Trend('auth_latency', true);
const peakVus         = new Gauge('peak_vus_at_failure');

export const options = {
  stages: [
    { duration: '30s', target: 10   },   // Warmup
    { duration: '1m',  target: 50   },   // Normal load
    { duration: '30s', target: 100  },   // High load
    { duration: '30s', target: 150  },   // Stress
    { duration: '30s', target: 200  },   // Peak stress
    { duration: '1m',  target: 200  },   // Sustained stress — find breaking point
    { duration: '30s', target: 100  },   // Recovery ramp-down
    { duration: '30s', target: 0    },   // Full cool-down
  ],
  thresholds: {
    // Stress targets — more lenient than load test
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.10'],     // up to 10% errors under extreme load
    error_rate:        ['rate<0.10'],
  },
};

function uniqueEmail() {
  return `stress_${__VU}_${__ITER}_${Date.now()}@test.spotme`;
}

export default function () {
  let token = null;

  /* ── Signup (heaviest: bcrypt hash) ── */
  group('signup', () => {
    const res = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
      email:     uniqueEmail(),
      password:  'StressTest1!Pass',
      firstName: 'Stress',
      lastName:  'Tester',
    }), { headers: { 'Content-Type': 'application/json' } });

    signupLatency.add(res.timings.duration);

    const ok = check(res, { 'signup ≤ 200 or 409': r => r.status === 200 || r.status === 409 });
    if (!ok) {
      errorRate.add(1);
      peakVus.add(__VU);
      return;
    }
    if (res.status === 200) token = res.json('token');
  });

  if (!token) { sleep(0.5); return; }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Auth me ── */
  group('me', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers });
    authLatency.add(res.timings.duration);
    const ok = check(res, { 'me ≤ 200': r => r.status === 200 });
    if (!ok) errorRate.add(1);
  });

  /* ── Sessions list ── */
  group('sessions', () => {
    const res = http.get(`${BASE_URL}/api/sessions`, { headers });
    check(res, { 'sessions ≤ 200': r => r.status === 200 }) || errorRate.add(1);
  });

  /* ── Logout ── */
  group('logout', () => {
    const res = http.post(`${BASE_URL}/api/auth/logout`, null, { headers });
    check(res, { 'logout ≤ 200': r => r.status === 200 }) || errorRate.add(1);
  });

  sleep(0.2);
}

export function handleSummary(data) {
  return {
    'tests/k6/reports/stress-summary.json': JSON.stringify(data, null, 2),
    stdout: buildStressReport(data),
  };
}

function buildStressReport(data) {
  const m    = data.metrics;
  const p50  = m.http_req_duration?.values?.['p(50)']?.toFixed(1) ?? '-';
  const p95  = m.http_req_duration?.values?.['p(95)']?.toFixed(1) ?? '-';
  const p99  = m.http_req_duration?.values?.['p(99)']?.toFixed(1) ?? '-';
  const rps  = m.http_reqs?.values?.rate?.toFixed(1) ?? '-';
  const errs = ((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const maxVu= m.vus_max?.values?.max ?? '-';

  const signupP95 = m.signup_latency?.values?.['p(95)']?.toFixed(1) ?? '-';
  const authP95   = m.auth_latency?.values?.['p(95)']?.toFixed(1) ?? '-';

  return `
╔══════════════════════════════════════╗
║       STRESS TEST RESULTS            ║
╠══════════════════════════════════════╣
║ Peak VUs          : ${String(maxVu).padEnd(14)} ║
║ Throughput (peak) : ${String(rps + ' req/s').padEnd(14)} ║
╠══════════════════════════════════════╣
║ RESPONSE TIMES                       ║
║   p50             : ${String(p50 + ' ms').padEnd(14)} ║
║   p95             : ${String(p95 + ' ms').padEnd(14)} ║
║   p99             : ${String(p99 + ' ms').padEnd(14)} ║
╠══════════════════════════════════════╣
║ ENDPOINT BREAKDOWN                   ║
║   signup p95      : ${String(signupP95 + ' ms').padEnd(14)} ║
║   auth   p95      : ${String(authP95   + ' ms').padEnd(14)} ║
╠══════════════════════════════════════╣
║ Error rate        : ${String(errs + ' %').padEnd(14)} ║
╠══════════════════════════════════════╣
║ PASS: error<10%   ${errs < 10 ? '✓' : '✗ FAIL'}              ║
╚══════════════════════════════════════╝

Note: CPU/memory utilisation must be measured externally.
      Recommended tool: 'node --prof' or 'clinic.js doctor'
`;
}
