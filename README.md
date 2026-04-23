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
```

## Folder structure

```
spotme/
├── index.html          Frontend entry — loads React, Tailwind, all .jsx files
├── App.jsx             Top-level router (marketing / auth / app shell)
├── styles.css          All component styles — liquid-glass design system
├── src/
│   ├── api.js          Fetch wrapper: Bearer token, localStorage, uniform returns
│   ├── icons.jsx       SVG icon library
│   ├── primitives.jsx  TextInput, PasswordInput, PrimaryButton, etc.
│   ├── AppShell.jsx    Sidebar + top bar + page routing (logged-in)
│   ├── AuthCard.jsx    Login + Signup (step 1 & 2) wired to real backend
│   ├── ChatPage.jsx    Chat UI + workout carousel (still uses canned replies)
│   ├── HistoryPage.jsx History list (still uses in-memory mock)
│   ├── HomePage.jsx    Public marketing page
│   ├── ProfilePage.jsx Profile + Metrics + Subscription
│   └── UnderDev.jsx    Reusable "under development" placeholder
└── server/
    ├── package.json    Dependencies: express, groq-sdk, sql.js, bcryptjs, cors, dotenv
    ├── .env.example    Config template — copy to .env and fill in GROQ_API_KEY
    ├── server.js       Express app, middleware, static serving, health endpoint
    ├── db.js           SQLite setup + all prepared statements
    └── routes/
        ├── _shared.js  requireAuth middleware, ApiError, publicUser helper
        ├── auth.js     POST /signup /login /logout, GET /me
        ├── chat.js     POST /api/chat → Groq Llama 3.3 70B
        ├── identify.js POST /api/identify → Groq Llama 3.2 Vision (JSON mode)
        ├── sessions.js GET/DELETE /api/sessions and /api/sessions/:id
        └── profile.js  PATCH /api/profile, POST /api/profile/upgrade
```

## Running locally

```bash
cd server
cp .env.example .env
# Open .env, replace REPLACE_ME with your Groq API key from https://console.groq.com/keys
npm install
npm start
# Open http://localhost:8787
```

The backend serves the frontend from the parent directory, so one process serves everything.

## What's working end-to-end

- [x] Marketing home page → Sign Up / Log In routing
- [x] Signup (2-step): persists to SQLite, returns session token
- [x] Login: bcrypt compare, returns new token
- [x] Logout: deletes token from DB
- [x] Token persists in localStorage; page refresh stays logged in
- [x] Auth error surfaces correctly (wrong password, duplicate email highlighted on the email field)
- [x] Per-field validation errors from the backend surface inline on the right step
- [x] AppShell: sidebar + New chat + History + Tracker + Profile
- [x] Tracker → "Pro feature" under-development panel
- [x] History page: empty state + "Start chatting" CTA
- [x] Profile page: change name / username / weight / height / level / avatar (UI only)
- [x] Notification bell toggle
- [x] All backend routes scaffold: /api/chat, /api/identify, /api/sessions, /api/profile

## What's NOT done yet (open backlog)

### Priority 1 — Frontend → backend wiring

- [ ] ChatPage: replace canned-reply system with real POST /api/chat calls
- [ ] ChatPage: "Upload image" / "Take a picture" → real POST /api/identify
- [ ] HistoryPage: load real sessions from GET /api/sessions
- [ ] ProfilePage: save changes via PATCH /api/profile
- [ ] Session management: "New chat" clears session and creates new one on the backend

### Priority 2 — UI features requested but not built

- [ ] Carousel: true infinite loop, pause on hover, arrows only visible on hover, placeholder images per workout type
- [ ] Pricing / subscription page: Free vs Pro tiers, "Current plan" indicator, Pro "Get Started" → under-dev modal
- [ ] Profile dropdown menu: clicking avatar chip opens menu with Account / Upgrade plan / Help / Sign out
- [ ] Remove "Log out" from top-right bar; put it in profile dropdown
- [ ] Remove "Upgrade to Pro" card from sidebar; move to profile dropdown
- [ ] Camera capture via getUserMedia (currently opens file picker)
- [ ] Avatar upload with image preview and delete

### Priority 3 — Validation improvements

- [ ] Name fields: letters-only regex + error messages
- [ ] Email: typo detection (gmial → gmail suggestions)
- [ ] Phone: full libphonenumber-js validation with per-country placeholder
- [ ] Password strength meter (zxcvbn)
- [ ] More vertical breathing room below form fields for error messages

### Priority 4 — Core product features

- [ ] Machine identification result card: muscle diagram SVG highlighting affected muscles
- [ ] Structured identify result rendering (not just markdown text)
- [ ] History: search + filter by machine / muscle / body region tags
- [ ] History: sessions auto-tagged from identify results (backend does this, frontend doesn't show it)
- [ ] "New chat" properly archives current session to history

### Priority 5 — Deferred

- [ ] Voice input (speech-to-text via Groq Whisper)
- [ ] Email deliverability / typo-detection service
- [ ] Real payment integration for Pro plan

## Key design decisions

1. **No build step.** React is transpiled in-browser by Babel standalone. Fast to prototype; fine for local dev and demo. Not for production at scale.

2. **sql.js** not better-sqlite3. Pure WASM, installs on any OS without Python or native build tools. Trade-off: DB lives in memory, serialized to disk on each write.

3. **Same-origin architecture.** The backend serves the frontend files via `express.static`. No CORS headaches; the `api.js` fetch wrapper uses relative URLs.

4. **Token in localStorage.** The token is a 64-char hex string. On mount, `App.jsx` checks localStorage, calls `/api/auth/me` to verify, and skips marketing + auth if valid.

5. **Two Groq models.** Chat uses Llama 3.3 70B (best quality, higher latency). Image identify uses Llama 3.2 11B Vision (vision-capable). The chat route auto-promotes to the vision model when the conversation has any image in it.
