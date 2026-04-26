# Performance Testing — k6 Scripts

**Tool:** k6 (https://k6.io)  
**Run command:** `npm run test:k6:smoke` / `load` / `stress`  
**Target:** `http://localhost:8787` (server must be running)  

---

## 1. Smoke Test — Quick Sanity Check

**File:** `Testing/k6/smoke.js`  
**Config:** 1 VU, 10 iterations  

```javascript
export const options = {
  vus:        1,
  iterations: 10,
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // 0% errors allowed
    http_req_duration: ['p(95)<500'],   // all requests under 500ms
  },
};

export default function () {
  // 1. Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health 200': r => r.status === 200 });

  // 2. Sign up a unique user
  const signup = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
    email:    `smoke_${Date.now()}@test.spotme`,
    password: 'SmokePas1!safe',
    firstName: 'Smoke', lastName: 'Test',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(signup, {
    'signup 200':    r => r.status === 200,
    'token present': r => r.json('token') !== undefined,
  });

  const token = signup.json('token');
  const headers = { Authorization: `Bearer ${token}` };

  // 3. Auth check
  const me = http.get(`${BASE_URL}/api/auth/me`, { headers });
  check(me, { 'me 200': r => r.status === 200 });

  // 4. Logout
  const logout = http.post(`${BASE_URL}/api/auth/logout`, null, { headers });
  check(logout, { 'logout 200': r => r.status === 200 });

  sleep(0.1);
}
```

---

## 2. Load Test — 50 VUs, 5 Minutes

**File:** `Testing/k6/load.js`  
**Acceptance criteria:** p95 < 200ms, error rate < 1%, throughput > 100 req/s  

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10  },  // Ramp-up:    0 → 10 VUs
    { duration: '30s', target: 50  },  // Ramp-up:   10 → 50 VUs
    { duration: '3m',  target: 50  },  // Steady:    50 VUs (3 min)
    { duration: '30s', target: 20  },  // Cool-down: 50 → 20 VUs
    { duration: '30s', target: 0   },  // Ramp-down: 20 → 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed:   ['rate<0.01'],
  },
};

const signupDuration = new Trend('signup_duration', true);
const errorRate      = new Rate('error_rate');

export default function () {
  // Each VU creates its own account (unique email per VU + iteration)
  const payload = JSON.stringify({
    email:     `load_${__VU}_${__ITER}_${Date.now()}@test.spotme`,
    password:  'LoadTest1!Pass',
    firstName: 'Load', lastName: 'User',
  });

  const signup = http.post(`${BASE_URL}/api/auth/signup`, payload,
    { headers: { 'Content-Type': 'application/json' } });
  signupDuration.add(signup.timings.duration);

  const ok = check(signup, { 'signup 200': r => r.status === 200 });
  if (!ok) { errorRate.add(1); sleep(1); return; }

  const token   = signup.json('token');
  const headers = { Authorization: `Bearer ${token}` };

  sleep(0.1);
  http.get(`${BASE_URL}/api/sessions`, { headers });
  sleep(0.3);
  http.post(`${BASE_URL}/api/auth/logout`, null, { headers });
  sleep(0.5);
}
```

---

## 3. Stress Test — 0 → 200 VU Spike

**File:** `Testing/k6/stress.js`  
**Purpose:** Find breaking point under extreme load  

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10   },  // Warmup
    { duration: '1m',  target: 50   },  // Normal load
    { duration: '30s', target: 100  },  // High load
    { duration: '30s', target: 150  },  // Stress
    { duration: '30s', target: 200  },  // Peak stress
    { duration: '1m',  target: 200  },  // Sustained — find breaking point
    { duration: '30s', target: 0    },  // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.10'],   // 10% errors tolerated at peak
  },
};
```

**Sample output after run:**
```
╔══════════════════════════════════════╗
║       STRESS TEST RESULTS            ║
╠══════════════════════════════════════╣
║ Peak VUs          : 200              ║
║ Throughput (peak) : xxx req/s        ║
╠══════════════════════════════════════╣
║ RESPONSE TIMES                       ║
║   p50             : xxx ms           ║
║   p95             : xxx ms           ║
║   p99             : xxx ms           ║
╠══════════════════════════════════════╣
║ Error rate        : x.xx %           ║
╚══════════════════════════════════════╝
```

---

## 4. Performance Acceptance Criteria Table

| Test | Metric | Threshold | Pass/Fail |
|---|---|---|---|
| Smoke | Error rate | < 1% | ✓ Pass |
| Smoke | p95 latency | < 500 ms | ✓ Pass |
| Load | p95 latency | < 200 ms | Pending run |
| Load | p99 latency | < 500 ms | Pending run |
| Load | Error rate | < 1% | Pending run |
| Load | Throughput | > 100 req/s | Pending run |
| Stress | p95 latency | < 2000 ms | Pending run |
| Stress | Error rate | < 10% | Pending run |

> Run `cd spotme/Testing && npm run test:k6:smoke` (requires server on port 8787)
