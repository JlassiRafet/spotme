# SpotMe — AI Fitness Coach

A web app where users sign up, set up their fitness profile, then chat with an AI coach (Llama 3.3 70B via Groq). The core feature: take a photo of a gym machine and get an AI identification of the machine, muscles it works, how to use it, and a personalized workout plan.

## Tech stack

```
Frontend  in-browser React (Babel standalone, no build step)
          Tailwind CSS (CDN)
          Vanilla CSS (styles.css) with a liquid-glass iOS aesthetic
          Split into src/*.jsx files loaded via <script type="text/babel">

Backend   Node.js + Express
          SQLite (sql.js, pure WASM — no native compile needed)
          Groq SDK for Llama 3.3 70B (chat) + Llama 3.2 Vision (image ID)
          bcryptjs for password hashing
          Session tokens (random hex, stored in DB, sent as Bearer header)

Testing   Vitest v2 — unit + integration tests (74 tests, 3 files)
          supertest — HTTP assertions against Express app (no server needed)
          sql.js in-memory — real SQLite, reset between tests
          k6 — performance/load/stress testing (requires live server)
```

---

## Folder structure

```
spotme/
├── index.html              Frontend entry — loads React, Tailwind, all .jsx files
├── App.jsx                 Top-level router (marketing / auth / app shell)
├── styles.css              All component styles — liquid-glass design system
│
├── src/                    React frontend components
│   ├── api.js              Fetch wrapper: Bearer token, localStorage, uniform returns
│   ├── icons.jsx           SVG icon library (all app icons in one file)
│   ├── primitives.jsx      Reusable UI — TextInput, PasswordInput, PrimaryButton, etc.
│   ├── AppShell.jsx        Sidebar + top bar + page routing for logged-in users
│   ├── AuthCard.jsx        Login + 2-step Signup, wired to real backend
│   ├── ChatPage.jsx        Chat UI + SSE streaming responses from Groq
│   ├── HistoryPage.jsx     Session history list — loads from GET /api/sessions
│   ├── HomePage.jsx        Public marketing page
│   ├── ProfilePage.jsx     Profile + Metrics + Subscription settings
│   ├── AboutPage.jsx       About / info page
│   ├── PlansPage.jsx       Pricing and subscription tiers
│   ├── IdentifyCard.jsx    Equipment identification result card (Groq Vision)
│   └── UnderDev.jsx        Reusable "under development" placeholder
│
├── server/                 Node.js + Express backend
│   ├── package.json        Dependencies: express, groq-sdk, sql.js, bcryptjs, cors, dotenv
│   ├── .env.example        Config template — copy to .env and fill GROQ_API_KEY
│   ├── server.js           Express app, middleware, static serving, health endpoint
│   ├── db.js               SQLite schema + all prepared statements
│   └── routes/
│       ├── _shared.js      requireAuth middleware, ApiError, publicUser helper
│       ├── auth.js         POST /signup /login /logout /account, GET /me
│       ├── chat.js         POST /api/chat/stream → Groq Llama 3.3 70B (SSE)
│       ├── identify.js     POST /api/identify → Groq Llama 3.2 Vision (JSON mode)
│       ├── sessions.js     GET/PATCH/DELETE /api/sessions and /api/sessions/:id
│       └── profile.js      PATCH /api/profile, POST /api/profile/upgrade (501 stub)
│
├── Testing/                Full test suite — kept alongside source for easy access
│   ├── package.json        Test dependencies: vitest, supertest, sql.js, bcryptjs
│   ├── vitest.config.js    Vitest config — node env, 20s timeout, coverage setup
│   │
│   ├── unit/
│   │   └── shared.test.js  14 white-box tests — ApiError, newToken, publicUser,
│   │                       requireAuth (all 6 branches covered)
│   │
│   ├── integration/
│   │   ├── auth.test.js    34 black-box tests — EP/BVA/DT/ST for all auth routes
│   │   └── sessions.test.js 26 black-box tests — sessions CRUD + profile PATCH
│   │
│   ├── helpers/
│   │   ├── in-memory-db.js Real sql.js SQLite database seeded in memory for tests
│   │   └── make-app.js     Express app factory used by supertest (no listen)
│   │
│   ├── k6/                 Performance tests — requires live server on port 8787
│   │   ├── smoke.js        1 VU, 10 iterations — quick sanity check (p95 < 500ms)
│   │   ├── load.js         50 VUs, 5 min — acceptance test (p95 < 200ms)
│   │   └── stress.js       0 → 200 VU spike — find breaking point (p95 < 2000ms)
│   │
│   ├── docs/
│   │   ├── TEST_PLAN.md         Scope, objectives, environment, schedule, acceptance criteria
│   │   ├── TRACEABILITY_MATRIX.md  53 requirements mapped to test IDs
│   │   └── DEFECT_LOG.md        Known bugs: ID, severity, priority, steps to reproduce
│   │
│   └── code snipets/       Report-ready excerpts of all test code
│       ├── 01_test_execution_results.md   Full 74-test verbose output (3.39s)
│       ├── 02_white_box_unit_tests.md     Unit test code — vi.hoisted, branch coverage
│       ├── 03_black_box_auth_tests.md     EP/BVA/DT/ST auth test snippets
│       ├── 04_black_box_sessions_tests.md Sessions + profile test snippets
│       └── 05_performance_k6_tests.md     k6 scripts + acceptance criteria table
│
└── graphify-out/           Graphify visualisation output (auto-generated)
```

---

## Running the server

```bash
# 1. Install dependencies
cd server
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — replace REPLACE_ME with your Groq API key
# Get one free at: https://console.groq.com/keys

# 3. Start
npm start
# Server runs at http://localhost:8787
```

The backend serves the frontend from the parent directory — one process serves everything.

---

## Accessing the app on different devices

The server binds to `0.0.0.0`, so any device on your local network can reach it.

**Find your machine's local IP:**
```bash
# Windows
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter, e.g. 192.168.1.42

# Mac / Linux
ifconfig | grep "inet "
```

**Open on any device:**
```
http://<your-ip>:8787
# Example: http://192.168.1.42:8787
```

Works on phones, tablets, and other laptops — as long as they're on the same Wi-Fi. No tunnelling needed.

> If the page doesn't load on another device, check your firewall: allow inbound TCP on port 8787.

---

## Running the tests

### Vitest — unit + integration (74 tests)

No live server needed. Uses an in-memory SQLite database.

```bash
cd Testing
npm install          # first time only

# Run all tests
npm test

# Run with verbose output (see every test name)
npm test -- --reporter=verbose

# Run a single file
npm test -- unit/shared.test.js
npm test -- integration/auth.test.js
npm test -- integration/sessions.test.js

# Generate HTML coverage report → Testing/coverage/index.html
npm run test:coverage
```

Expected output:
```
 Test Files  3 passed (3)
      Tests  74 passed (74)
   Duration  ~3.4s
```

---

### k6 — performance tests (requires live server)

Install k6 first: https://k6.io/docs/get-started/installation/

```bash
# Start the server in one terminal
cd server && npm start

# In another terminal — run from Testing/
cd Testing

# Smoke test — 1 VU, 10 iterations, ~5 seconds
npm run test:k6:smoke

# Load test — 50 VUs, 5 minutes, ramp up/down
npm run test:k6:load

# Stress test — 0 → 200 VU spike, find breaking point
npm run test:k6:stress
```

**k6 acceptance thresholds:**

| Test   | Metric       | Threshold    |
|--------|--------------|--------------|
| Smoke  | Error rate   | < 1%         |
| Smoke  | p95 latency  | < 500 ms     |
| Load   | p95 latency  | < 200 ms     |
| Load   | Error rate   | < 1%         |
| Load   | Throughput   | > 100 req/s  |
| Stress | p95 latency  | < 2000 ms    |
| Stress | Error rate   | < 10%        |

---

## What's working end-to-end

- [x] Marketing home page → Sign Up / Log In routing
- [x] Signup (2-step): persists to SQLite, returns session token
- [x] Login: bcrypt compare, returns new token
- [x] Logout: deletes token from DB, invalidates immediately
- [x] Token persists in localStorage; page refresh stays logged in
- [x] Auth errors surface correctly (wrong password, duplicate email)
- [x] Per-field validation errors from backend surface inline
- [x] AppShell: sidebar + mobile drawer + New chat + History + Profile + Plans + About
- [x] Chat: real Groq Llama 3.3 70B with SSE streaming responses
- [x] History page: loads real sessions, reopen reopens session
- [x] Equipment identify: Groq Llama 3.2 Vision → JSON result card
- [x] Profile page: view profile data
- [x] All auth routes: signup, login, logout, /me, delete account
- [x] Session routes: list, get, rename, delete
- [x] 74 automated tests passing (unit + integration)

## What's NOT done yet

- [ ] ProfilePage: save changes via PATCH /api/profile (UI only)
- [ ] Tracker page (placeholder only)
- [ ] Payment / upgrade flow (501 stub — under development)
- [ ] Selenium / browser E2E tests
- [ ] Avatar upload with preview
- [ ] Voice input (Groq Whisper)

---

## Key design decisions

1. **No build step.** React is transpiled in-browser by Babel standalone. Fast to prototype; fine for demo. Not for production at scale.

2. **sql.js** not better-sqlite3. Pure WASM, installs on any OS without Python or native build tools. DB lives in memory, serialized to disk on each write.

3. **Same-origin architecture.** Backend serves frontend via `express.static`. No CORS issues; `api.js` uses relative URLs.

4. **Token in localStorage.** 64-char hex token. On mount, `App.jsx` checks localStorage, calls `/api/auth/me` to verify, skips auth screen if valid.

5. **Two Groq models.** Chat uses Llama 3.3 70B (best quality). Image identify uses Llama 3.2 11B Vision. Chat route auto-promotes to vision model when a conversation contains an image.

6. **Testing in-process.** Tests import routes directly and inject an in-memory DB — no live server, no network, resets between each test. Fast and deterministic.
