# SpotMe — AI Fitness Coach

A full-stack AI fitness web app. Sign up, set a fitness profile, chat with an AI coach, identify gym equipment from photos, and follow guided workout programs with live muscle-map visualisations.

## Tech stack

```
Frontend  In-browser React (Babel standalone — no build step)
          Tailwind CSS (CDN) + custom CSS design system (styles.css)
          Dark-green athletic theme with teal (#00e5c0) accent, Oswald display font
          Components in src/*.jsx, loaded via <script type="text/babel">

Backend   Node.js 24 + Express
          SQLite (sql.js — pure WASM, no native compile)
          Groq SDK — llama-3.3-70b-versatile (chat) + llama-4-scout-17b (vision)
          bcryptjs — password hashing
          Bearer tokens — 64-char hex, stored in DB

Testing   Vitest v2 — unit + integration (74 tests, 3 files)
          supertest — HTTP assertions against Express (no live server)
          sql.js in-memory — real SQLite, reset between tests
          k6 — performance / load / stress (requires live server)
```

---

## Folder structure

```
spotme/
├── index.html              Frontend entry — loads React, Tailwind, all .jsx files
├── App.jsx                 Top-level router (marketing / auth / app shell)
├── styles.css              Design system — dark-green theme, teal accents, glass surfaces
│
├── src/                    React frontend components
│   ├── api.js              Fetch wrapper — Bearer token, localStorage, uniform returns
│   ├── icons.jsx           SVG icon library
│   ├── primitives.jsx      Reusable UI — TextInput, PasswordInput, PrimaryButton, etc.
│   ├── AppShell.jsx        Sidebar + top bar + page routing for logged-in users
│   ├── AuthCard.jsx        Sign In + 2-step Sign Up — wired to real backend
│   ├── ChatPage.jsx        Chat UI + SSE streaming from Groq
│   ├── HistoryPage.jsx     Session history — real data from GET /api/sessions
│   ├── HomePage.jsx        Public marketing page
│   ├── ProfilePage.jsx     Profile, metrics, subscription settings
│   ├── ProgramsPage.jsx    Program grid with category filter
│   ├── ProgramDetailPage.jsx  Program detail + SessionRunner (timer, MuscleMap, steps)
│   ├── TrackerPage.jsx     Activity tracker — streak, charts, quick-log
│   ├── CompletionPage.jsx  Post-workout completion screen
│   ├── PlansPage.jsx       Pricing / subscription tiers
│   ├── AboutPage.jsx       About page
│   ├── IdentifyCard.jsx    Equipment ID result card (Groq Vision)
│   └── components/
│       └── MuscleMap.jsx   SVG front/back body diagram — highlights muscles worked
│
├── server/                 Node.js + Express backend
│   ├── package.json        express, groq-sdk, sql.js, bcryptjs, cors, dotenv, stripe
│   ├── .env.example        Config template — copy to .env and fill in keys
│   ├── server.js           Express app, middleware, static serving, health endpoint
│   ├── db.js               SQLite schema, prepared statements, seed + patch functions
│   └── routes/
│       ├── _shared.js      requireAuth, ApiError, publicUser
│       ├── auth.js         POST /signup /login /logout /account, GET /me
│       ├── chat.js         POST /api/chat/stream — Groq Llama 3.3 70B (SSE)
│       ├── identify.js     POST /api/identify — Groq Llama 4 Scout Vision (JSON)
│       ├── sessions.js     GET/PATCH/DELETE /api/sessions and /api/sessions/:id
│       ├── profile.js      PATCH /api/profile, POST /api/profile/upgrade
│       ├── programs.js     GET /api/programs — workout programme catalogue
│       ├── tracker.js      GET/POST /api/tracker — workout logs + stats
│       └── webhook.js      POST /api/webhook/stripe — Stripe payment events
│
├── Testing/                Full test suite
│   ├── unit/shared.test.js        14 tests — ApiError, requireAuth branch coverage
│   ├── integration/auth.test.js   34 tests — EP/BVA/DT/ST for all auth routes
│   ├── integration/sessions.test.js  26 tests — sessions CRUD + profile PATCH
│   ├── k6/smoke.js                1 VU, 10 iterations — sanity check
│   ├── k6/load.js                 50 VUs, 5 min — acceptance test
│   ├── k6/stress.js               0→200 VU spike — find breaking point
│   └── docs/                      TEST_PLAN, TRACEABILITY_MATRIX, DEFECT_LOG
│
└── graphify-out/           Graphify visualisation output (auto-generated)
```

---

## Running the server

```bash
# 1. Install dependencies
cd server
npm install

# 2. Configure
cp .env.example .env
# Edit .env — add your Groq API key (get one free at https://console.groq.com/keys)

# 3. Start (production)
npm start

# 3a. Start (dev — auto-restart on file change)
npm run dev

# Server + frontend on http://localhost:8787
```

---

## Accessing from other devices

The server binds to `0.0.0.0`. Any device on the same Wi-Fi can reach it.

```bash
# Find your local IP
ipconfig          # Windows — look for IPv4 Address under Wi-Fi
ifconfig          # Mac / Linux

# Open on any device
http://<your-ip>:8787
```

> Firewall blocking it? Allow inbound TCP on port 8787.

---

## Running tests

### Vitest — unit + integration (74 tests, no live server needed)

```bash
cd Testing
npm install           # first time only

npm test              # run all
npm test -- --reporter=verbose
npm test -- unit/shared.test.js
npm test -- integration/auth.test.js
npm test -- integration/sessions.test.js
npm run test:coverage # HTML report → Testing/coverage/index.html
```

Expected:
```
 Test Files  3 passed (3)
      Tests  74 passed (74)
   Duration  ~3.4s
```

### k6 — performance tests (requires live server)

```bash
# Terminal 1
cd server && npm start

# Terminal 2
cd Testing
npm run test:k6:smoke    # 1 VU, ~5s
npm run test:k6:load     # 50 VUs, 5 min
npm run test:k6:stress   # 0→200 VU spike
```

| Test   | Metric      | Threshold  |
|--------|-------------|------------|
| Smoke  | p95 latency | < 500 ms   |
| Smoke  | Error rate  | < 1%       |
| Load   | p95 latency | < 200 ms   |
| Load   | Error rate  | < 1%       |
| Load   | Throughput  | > 100 req/s|
| Stress | p95 latency | < 2000 ms  |
| Stress | Error rate  | < 10%      |

---

## What's working

- [x] Marketing landing page → Sign Up / Sign In routing
- [x] Sign Up (2-step with profile setup) — persists to SQLite, returns session token
- [x] Sign In — bcrypt compare, returns new token
- [x] Logout — deletes token, invalidates immediately
- [x] Token in localStorage — page refresh stays logged in
- [x] Auth errors surface inline (wrong password, duplicate email, per-field validation)
- [x] AppShell — sidebar, mobile drawer, New Chat, History, Programs, Tracker, Profile
- [x] Chat — Groq Llama 3.3 70B with SSE streaming
- [x] History — loads real sessions, reopening restores context
- [x] Equipment identify — Groq Llama 4 Scout Vision → JSON result card with muscles
- [x] Programs — Push Day, Pull Day, Leg Day, Upper Body, Lower Body, Core, Yoga, Cycling
- [x] Workout runner — step-by-step timer with MuscleMap SVG (front + back body diagram)
- [x] MuscleMap — highlights chest, shoulders, lats, quads, hamstrings etc. per exercise
- [x] Tracker — activity log, streak card, weekly chart, quick-add exercises
- [x] Auth + onboarding rethemed — dark green background, teal (#00e5c0) accent, Oswald font
- [x] Stripe webhook endpoint (payment flow stub)
- [x] 74 automated tests passing (unit + integration)

## What's not done yet

- [ ] Payment / upgrade flow (Stripe wired but UI flow incomplete)
- [ ] ProfilePage save changes via PATCH /api/profile
- [ ] Avatar upload
- [ ] Voice input (Groq Whisper)
- [ ] Selenium / browser E2E tests

---

## Key design decisions

1. **No build step.** Babel transpiles JSX in-browser. Fast to prototype; not for production scale.

2. **sql.js over better-sqlite3.** Pure WASM — installs on any OS without Python or native tools. DB lives in memory, serialised to disk on each write.

3. **Same-origin architecture.** Express serves the frontend via `express.static`. `api.js` uses relative URLs — no CORS configuration needed.

4. **Token in localStorage.** 64-char hex token. On mount, `App.jsx` checks localStorage, calls `/api/auth/me` to verify, skips auth screen if valid.

5. **Two Groq models.** Chat uses `llama-3.3-70b-versatile`. Vision uses `meta-llama/llama-4-scout-17b-16e-instruct`. Both configured via `.env` — swap without touching code.

6. **Patch-based DB migrations.** `seedPrograms()` runs once on first boot. `patchDietMacro()`, `patchDietPrograms()`, `patchMusclePrograms()` run on every boot — content updates reach existing databases automatically.

7. **MuscleMap driven by `tips` field.** Each program session has a `tips` string starting with `Primary: chest, shoulders, triceps`. The `MuscleMap` SVG parses this and lights up the correct regions — no hardcoded muscle lists in the UI.
