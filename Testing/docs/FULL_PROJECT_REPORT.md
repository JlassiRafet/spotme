# SpotMe — Full Project Report
**Date:** 2026-04-29 | **Team:** Rafet Jlassi | **Version:** 1.0.0

---

## 1. Executive Summary

SpotMe is an AI-powered fitness web application that provides users with a personalised coaching experience through a conversational AI interface backed by Meta's Llama model via the Groq inference API. The app covers the full workout lifecycle: plan discovery, session logging, activity tracking, nutrition guidance, membership management, and settings. It ships as a single-page application (SPA) frontend rendered in the browser with an Express/SQLite backend handling auth, AI integration, and data persistence.

---

## 2. Technology Stack

### 2.1 Frontend
| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| UI Framework | React (in-browser Babel) | 18.x CDN | Zero build-step, instant hot reload in development |
| Styling | CSS custom properties (design tokens) + plain CSS | — | Full control over dark/light theme, no utility-class overhead |
| Icons | Inline SVG IIFE module (`icons.jsx`) | — | Tree-shakeable, zero network request |
| Animations | CSS transitions + `cubic-bezier`, Framer Motion (CDN, optional) | — | Hardware-accelerated, no JS required |
| Fonts | Anthropic Sans → Inter → system-ui fallback | — | Consistent cross-platform typography |
| Routing | `history.pushState` (custom, no library) | — | Lightweight SPA routing without a router library |
| i18n | Custom `i18n.js` module | — | Lightweight multi-language support (EN/FR/AR) |

### 2.2 Backend
| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Runtime | Node.js | ≥ 18 | ESM support, modern `fetch` built-in |
| Framework | Express | 4.22 | Battle-tested, minimal overhead |
| Database | SQLite via `sql.js` | 1.11 | Zero external DB server, file-based, ACID |
| Auth | Bearer tokens (crypto.randomBytes) + bcrypt | — | Stateless, secure, bcrypt cost 11 |
| AI Chat | Groq SDK → `llama-3.3-70b-versatile` | 0.9 | Free-tier fast inference, 30 req/min |
| AI Vision | Groq SDK → `llama-4-scout-17b-16e-instruct` | — | Multimodal equipment identification |
| Payments | Stripe SDK | 22.x | Subscription checkout + webhook verification |
| OAuth | Google OAuth 2.0 (server-side flow) | — | Secure server-side code exchange, no token in URL |
| Audio | Groq Whisper (`whisper-large-v3-turbo`) | — | Voice-to-text transcription |
| File Upload | Multer | 1.4.5 | Multipart form handling for image uploads |

### 2.3 Testing
| Tool | Purpose | File Location |
|------|---------|---------------|
| Vitest | Unit + integration tests | `Testing/unit/`, `Testing/integration/` |
| Supertest | HTTP layer integration testing | `Testing/integration/` |
| k6 | Performance/load testing | `spotme-testing/server/tests/k6/` |
| Selenium WebDriver | End-to-end browser testing | `spotme-testing/selenium/tests/` |
| SonarQube | Static analysis + security scanning | `spotme-testing/sonar-project.properties` |

### 2.4 Dev Tools
- **VS Code** — primary editor
- **Claude Code** — AI pair programming (Anthropic)
- **Git + GitHub** — version control (`github.com/JlassiRafet/spotme`)
- **npm / pnpm** — dependency management
- **ChromeDriver** — Selenium browser automation

---

## 3. Application Pages

### 3.1 HomePage (Landing / Marketing Page)
**File:** `src/HomePage.jsx`
**Route:** `/` (pre-auth only)

**What it is:** The public marketing page shown to unauthenticated visitors.

**What it does:** Communicates the product value proposition, showcases features, displays testimonials, and drives conversion to signup or login.

**Why we added it:** Every SaaS product needs a conversion-optimised landing page to explain the "why" before asking users to create an account. First impressions determine whether someone signs up.

**Key elements:**
- Sticky pill-nav with SpotMe logo, nav links (Features, Why Us, Reviews), Log In and Get Started buttons
- Hero section: bold display headline + AI description + CTA buttons
- Animated stats bar: active members, workouts logged, programs, avg rating
- Feature cards grid: Exercise library, Smart tracking, Nutrition plans, AI coach
- Benefits section with "Why Us" proof points
- Testimonials ticker (scrolling) — social proof
- How It Works steps
- Final CTA section
- Footer with legal links
- ThemePill (dark/light toggle) fixed bottom-right

---

### 3.2 AuthCard (Sign Up + Log In)
**File:** `src/AuthCard.jsx`
**Route:** Overlaid on `/` (no URL change)

**What it is:** The authentication modal card, handling both signup (2-step) and login flows.

**What it does:** Validates user input client-side in real time, submits to `/api/auth/signup` or `/api/auth/login`, stores the Bearer token in `localStorage`, and transitions the user into the app shell.

**Why we added it:** Centralised auth reduces code duplication and ensures consistent UX across signup/login. The 2-step approach reduces cognitive load on the signup form.

**Key elements:**
- Step 1: First name, last name, email fields with live field-level errors
- Step 2: Password input with strength requirement feedback
- Google Sign-In button (OAuth server-side flow)
- "Already have an account?" / "Back to sign up" toggle
- PrimaryButton with liquid-glass effect
- Loading state while API call is in flight

**Validation rules:**
| Field | Rule |
|-------|------|
| First / Last name | Letters, spaces, hyphens, apostrophes only; 1–60 chars |
| Email | RFC-compliant pattern |
| Password | ≥ 12 chars, must include lower + upper + digit + symbol |
| Max length | Password ≤ 72 chars (bcrypt limit) |

---

### 3.3 AppShell
**File:** `src/AppShell.jsx`
**Route:** All authenticated routes (`/dashboard`, `/activities`, etc.)

**What it is:** The persistent chrome/wrapper for the authenticated app experience.

**What it does:** Manages client-side routing via `history.pushState`, renders the correct page component, shows the sidebar on desktop and a tab bar on mobile, and handles Stripe checkout return.

**Why we added it:** Separating the shell from page content allows smooth transitions, persistent sidebar state, and single-point session management.

**Key elements:**
- Sidebar (desktop): SpotMe logo, 5 nav icons (Home, Activities, Programs, Nutrition, Membership), profile avatar
- Tab bar (mobile, fixed bottom): same 5 destinations in pill form
- Mobile drawer: full-screen slide-in nav with all destinations
- Topbar: hamburger (mobile), context-sensitive title ("Settings"/"History"), bell notification icon
- Profile menu popover: avatar, name, email, Account/History/Upgrade links, Sign out
- Floating Dicter chip: opens chat overlay from anywhere

---

### 3.4 HomeFeed
**File:** `src/HomeFeed.jsx`
**Route:** `/dashboard`

**What it is:** The home screen shown after login — a personalised dashboard.

**What it does:** Greets the user by name, shows quick-action cards to navigate to key features, and provides the SpotMe wordmark with theme toggle.

**Why we added it:** Users need an oriented starting point after login, not a blank chat screen. Quick action cards reduce friction to common tasks.

**Key elements:**
- Home brand bar: SpotMe wordmark + ThemePill
- Personalised greeting with time-of-day suffix
- Quick action cards: Chat, Programs, Nutrition, Activities (teal/lime/orange/coral accents)
- Hero stat (e.g., current streak)
- ThemePill toggle for light/dark mode

---

### 3.5 ChatPage / Dicter
**File:** `src/ChatPage.jsx`
**Route:** Overlay accessible from any page via Dicter chip

**What it is:** The AI coaching interface — a streaming chat window.

**What it does:** Sends user messages to `/api/chat/stream` (Groq SSE endpoint) and renders the streamed Llama response token by token. Maintains session history across conversations.

**Why we added it:** The core product promise — an AI coach that knows your history. Every other feature feeds context into this interface.

**Key elements:**
- Message list: user bubbles (right, teal tint) + assistant bubbles (left)
- Empty state: greeting + suggestion chips for common questions
- Streaming cursor animation while AI types
- Chat input: textarea, image upload button (camera icon), voice input (mic), send button (enabled only when non-empty)
- Session history preserved per conversation

---

### 3.6 ActivitiesPage
**File:** `src/ActivitiesPage.jsx`
**Route:** `/activities`

**What it is:** A daily activity tracker dashboard.

**What it does:** Shows today's metrics (steps, water intake, calories), a weekly bar chart of calorie data pulled from `/api/metrics`, and a body exercise wave card.

**Why we added it:** Visibility into daily progress motivates consistent habits. The visual charts make abstract numbers tangible.

**Key elements:**
- Day-pill date strip: 5-day window, tap to view a specific day
- Steps tile + Waters tile (metric cards with coloured icons)
- Large calories display (3rem monospace number)
- Weekly bar chart: 7-day calorie bars with active-day callout
- Body exercise wave card: SVG area chart with kcal and BPM chips

---

### 3.7 ProgramsPage + ProgramDetailPage
**Files:** `src/ProgramsPage.jsx`, `src/ProgramDetailPage.jsx`
**Route:** `/programs`, `/program/:id`

**What it is:** A catalogue of structured workout programs.

**What it does:** Lists all available programs from `/api/programs` with filters by category (Strength, Cardio, HIIT, etc.), and shows full program detail with week-by-week schedule when tapped.

**Why we added it:** Structured programs provide progression and accountability beyond ad-hoc workouts. It's a core differentiator vs. generic AI chat.

**Key elements:**
- Category filter tabs (All, Strength, Cardio, HIIT, Flexibility, Sport)
- Program cards: cover image, title, difficulty badge, duration
- Program detail: hero image, overview, week schedule table, "Start Program" CTA

---

### 3.8 TrackerPage
**File:** `src/TrackerPage.jsx`
**Route:** `/activities` (also serves as the activity hub)

**What it is:** A placeholder/stub page for the full workout tracking feature.

**What it does:** Currently shows an "under development" state. Will eventually allow logging workout sessions with exercises, sets, reps, and weights.

**Why we added it:** Roadmap placeholder — the backend session routes (`/api/sessions`) are fully implemented and tested; the UI is the only pending piece.

---

### 3.9 MembershipPage
**File:** `src/MembershipPage.jsx`
**Route:** `/membership`

**What it is:** The subscription/pricing page.

**What it does:** Shows Free vs Pro tier features, handles the upgrade flow via Stripe Checkout, and shows a graceful fallback message if Stripe is unconfigured.

**Why we added it:** Monetisation — Pro tier adds live human coaching on top of the AI features.

**Key elements:**
- Hero band with crown icon
- Free tier card: $0/forever, 5 feature bullets, disabled CTA
- Pro tier card (featured): $12/month, 6 feature bullets including real coach access, upgrade CTA
- Stripe redirect on "Upgrade to Pro" click
- Graceful 503 fallback: "Pro payments are coming soon — email us at rafet.main@gmail.com"

---

### 3.10 ProfilePage (Settings)
**File:** `src/ProfilePage.jsx`
**Route:** `/profile`

**What it is:** The user settings and account management page.

**What it does:** Allows editing display name/username, viewing subscription status, changing language/appearance, managing spell-check, and deleting the account.

**Why we added it:** Account self-service is essential — users must be able to control their data, appearance, and subscription.

**Key elements:**
- Left nav: Account / App / About sections
- Account panel: avatar (with camera-edit overlay), display name, @username, email (read-only), subscription status, edit profile form, logout button, delete account (with confirmation phrase)
- App panel: Language selector (modal), Appearance selector (modal — Dark/Light/System), Spell-check toggle
- About panel: Report Bug, Help Centre, Terms, Privacy links
- Delete account dialog: requires typing "delete my account" to confirm

---

### 3.11 HistoryPage
**File:** `src/HistoryPage.jsx`
**Route:** `/history`

**What it is:** A log of all past chat sessions.

**What it does:** Fetches all sessions from `/api/sessions` and renders them as a list of session cards. Clicking a session reopens it in the chat.

**Why we added it:** The AI coach's value comes from memory and continuity. Users need to review past conversations and re-enter them.

**Key elements:**
- Topbar with "History" title
- Session cards: title, timestamp, preview of first user message
- Tap to reopen session in chat overlay

---

### 3.12 BookCoachPage
**File:** `src/BookCoachPage.jsx`
**Route:** `/book-coach`

**What it is:** Pro feature — book a live session with a real coach.

**What it does:** Shows available human coaches, their specialisations, and allows Pro subscribers to book a scheduled video/phone session.

**Why we added it:** The Pro plan's primary differentiator is access to real human coaches. This page is the booking interface for that service.

---

### 3.13 Supporting Pages
| Page | File | Purpose |
|------|------|---------|
| AboutPage | `src/AboutPage.jsx` | Team and mission information |
| HelpCenterPage | `src/HelpCenterPage.jsx` | FAQ and support articles |
| PrivacyPage | `src/PrivacyPage.jsx` | GDPR-compliant privacy policy |
| TermsPage | `src/TermsPage.jsx` | Terms of service |
| CompletionPage | `src/CompletionPage.jsx` | Post-workout session summary |
| IdentifyCard | `src/IdentifyCard.jsx` | Equipment identifier via Llama Vision |

---

## 4. Backend API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET    | `/api/health`                     | No   | Server health probe |
| POST   | `/api/auth/signup`                | No   | Register (bcrypt hash, token) |
| POST   | `/api/auth/login`                 | No   | Login (bcrypt compare, token) |
| POST   | `/api/auth/logout`                | Yes  | Invalidate token |
| GET    | `/api/auth/me`                    | Yes  | Get current user |
| DELETE | `/api/auth/account`               | Yes  | Delete account |
| GET    | `/api/auth/google`                | No   | Initiate Google OAuth |
| GET    | `/api/auth/google/callback`       | No   | Google OAuth callback |
| POST   | `/api/chat/stream`                | Yes  | Streaming chat (SSE) |
| POST   | `/api/identify`                   | Yes  | Vision: identify equipment |
| POST   | `/api/transcribe`                 | Yes  | Whisper voice-to-text |
| GET    | `/api/sessions`                   | Yes  | List all sessions |
| POST   | `/api/sessions`                   | Yes  | Create session |
| GET    | `/api/sessions/:id`               | Yes  | Get session detail |
| DELETE | `/api/sessions/:id`               | Yes  | Delete session |
| GET    | `/api/profile`                    | Yes  | Get profile |
| PATCH  | `/api/profile`                    | Yes  | Update profile |
| POST   | `/api/profile/upgrade`            | Yes  | Start Stripe checkout |
| POST   | `/api/subscription/finalize`      | Yes  | Finalize checkout (verify) |
| POST   | `/api/webhook`                    | No*  | Stripe webhook (sig verified) |
| GET    | `/api/programs`                   | Yes  | List programs |
| GET    | `/api/programs/:id`               | Yes  | Get program detail |
| GET    | `/api/metrics`                    | Yes  | Get activity metrics |
| POST   | `/api/tracker/log`                | Yes  | Log tracker entry |
| GET    | `/api/tracker/stats`              | Yes  | Get tracker stats |

\* Stripe webhook signature is verified server-side instead of Bearer token.

---

## 5. Testing

### 5.1 Unit Tests (Vitest)
**Location:** `Testing/unit/`

| File | Coverage |
|------|----------|
| `shared.test.js` | `newToken()`, `requireAuth` middleware, `publicUser()` sanitiser, `ApiError` class |

**Status:** All passing. Token generation entropy, auth middleware 401/403 paths, and user data sanitisation (no `password_hash` in response) all verified.

---

### 5.2 Integration Tests (Vitest + Supertest)
**Location:** `Testing/integration/` (also `spotme-testing/server/tests/integration/`)

Tests use an in-memory sql.js database — no filesystem writes, fully isolated.

| File | Test cases | Techniques |
|------|-----------|-----------|
| `auth.test.js` | 40+ | EP, BVA, Decision Tables, State Transition, Use-Case |
| `sessions.test.js` | 20+ | EP, BVA, State Transition |

**Key coverage:**
- Signup: valid, duplicate email, weak password, missing fields, name same as last name, weight/height boundary values
- Login: correct credentials, wrong password, timing-safe dummy bcrypt (missing user), OAuth-only user blocked from password login
- Logout: valid token, replayed token (401)
- Sessions: CRUD, auth guard, pagination, reopen

**Status:** All passing.

---

### 5.3 k6 Performance Tests
**Location:** `spotme-testing/server/tests/k6/`

| File | Type | Load Profile | Key Thresholds |
|------|------|-------------|----------------|
| `smoke.js`     | Smoke    | 1 VU, 10 iterations | p95 < 500 ms, 0% errors |
| `load.js`      | Load     | 50 VUs, 5 min | p95 < 200 ms, error < 1% |
| `stress.js`    | Stress   | Up to 200 VUs | p95 < 2 s, error < 10% |
| `spike.js`     | Spike    | Idle→300 VUs in 10 s | error < 15%, no connection refused |
| `volume.js`    | Volume   | 10 VUs × 200 sessions | create p95 < 300 ms, data errors < 5 |
| `endurance.js` | Endurance| 20 VUs × 30 min | error < 0.5%, latency drift < 50% |

**How to run:**
```bash
# From spotme-testing/server/
npm run test:k6:smoke
npm run test:k6:load
npm run test:k6:stress
npm run test:k6:spike
npm run test:k6:volume
npm run test:k6:endurance
```

**Expected results (local dev, bcrypt cost 11):**
- Smoke: p95 ≈ 80–150 ms ✓
- Load (50 VUs): p95 ≈ 120–180 ms (bcrypt dominates signup) — passes threshold
- Stress (200 VUs): p95 may reach 800–1200 ms — bcrypt is the bottleneck; within 2 s threshold
- Spike: Server survives without crash; connection errors = 0; latency spikes then recovers
- Volume: SQLite handles 2,000 inserts without timeout
- Endurance: No detectable latency drift in 30 min; stable error rate

---

### 5.4 Selenium E2E Tests
**Location:** `spotme-testing/selenium/tests/`

**Prerequisites:** Chrome + ChromeDriver installed, `npm install` in the selenium folder.

```bash
cd spotme-testing/selenium
npm install
npm run test:auth      # 11 auth test cases
npm run test:chat      # 8 chat test cases
npm run test:settings  # 10 settings test cases
```

| File | Test Cases | Coverage |
|------|-----------|----------|
| `auth.test.js`     | TC-A01–A11 | Landing page, signup form validation, weak password, full signup, login, wrong password, Google button, logout |
| `chat.test.js`     | TC-C01–C08 | Chat input presence, empty send guard, send enables button, user bubble, AI response, mic button, upload button, suggestion chips |
| `settings.test.js` | TC-S01–S10 | ThemePill toggle, dark default, light switch, label text, profile page, topbar title "Settings", email read-only, logout button, appearance modal |

---

### 5.5 SonarQube Static Analysis
**Config:** `spotme-testing/sonar-project.properties`

**How to run:**
```bash
# 1. Start SonarQube
docker run -d -p 9000:9000 --name sonarqube sonarqube:community

# 2. Wait ~60 seconds, then scan from spotme-testing/
sonar-scanner

# 3. View report
open http://localhost:9000/dashboard?id=spotme
```

**Rules configured to check:**
- S2068 — Hardcoded credentials (check `.env` is not committed)
- S5131 — XSS via reflected query params
- S4423 — Weak session secrets
- S5144 — SSRF via user-controlled `fetch` URL
- S2277 — SQL injection (all queries use parameterised statements)

**Expected quality gate:** A/A/A (no bugs, no vulnerabilities, <5% tech debt) on new code.

---

## 6. Folder Tree

```
spotme/                          ← Frontend + backend monorepo
├── index.html                   ← SPA entry point (loads all JSX via Babel CDN)
├── styles.css                   ← All CSS: design tokens, components, dark/light themes
├── src/
│   ├── api.js                   ← All fetch() calls + Bearer token management
│   ├── i18n.js                  ← Translations (EN/FR/AR) + useTranslation hook
│   ├── icons.jsx                ← SVG icon library (50+ icons)
│   ├── primitives.jsx           ← Shared UI atoms: TextInput, PasswordInput, ThemePill, etc.
│   ├── AppShell.jsx             ← Authenticated app chrome + SPA router
│   ├── HomePage.jsx             ← Public landing / marketing page
│   ├── AuthCard.jsx             ← Login + signup modal
│   ├── HomeFeed.jsx             ← Dashboard home (post-login)
│   ├── ChatPage.jsx             ← AI coach chat interface (streaming)
│   ├── ActivitiesPage.jsx       ← Daily activity dashboard
│   ├── ProgramsPage.jsx         ← Workout program catalogue
│   ├── ProgramDetailPage.jsx    ← Single program detail + schedule
│   ├── TrackerPage.jsx          ← Session tracker (stub)
│   ├── HistoryPage.jsx          ← Past chat sessions list
│   ├── MembershipPage.jsx       ← Pricing + Stripe upgrade
│   ├── ProfilePage.jsx          ← User settings
│   ├── BookCoachPage.jsx        ← Book live coach session (Pro)
│   ├── MuscleChart.jsx          ← SVG muscle diagram component
│   ├── StreakCard.jsx           ← Streak/goal card component
│   ├── TrendChart.jsx           ← Trend line chart component
│   ├── WeeklyChart.jsx          ← Weekly bar chart component
│   ├── CompletionPage.jsx       ← Post-workout summary
│   ├── IdentifyCard.jsx         ← Equipment identification via vision
│   ├── PlansPage.jsx            ← Legacy plans page (superseded by MembershipPage)
│   ├── AboutPage.jsx            ← About / mission page
│   ├── HelpCenterPage.jsx       ← Help centre / FAQ
│   ├── TermsPage.jsx            ← Terms of service
│   ├── PrivacyPage.jsx          ← Privacy policy
│   └── UnderDev.jsx             ← "Under development" placeholder card
│
├── server/
│   ├── server.js                ← Express entry point, CORS, route mounting
│   ├── db.js                    ← SQLite schema + all prepared statements
│   ├── config.js                ← dotenv load + env validation
│   ├── .env                     ← Secrets (gitignored)
│   ├── .env.example             ← Template for new devs
│   ├── spotme.sqlite            ← SQLite database file (gitignored)
│   └── routes/
│       ├── _shared.js           ← requireAuth, ApiError, newToken, publicUser
│       ├── auth.js              ← Signup, login, logout, /me, Google OAuth
│       ├── chat.js              ← Streaming AI chat (SSE)
│       ├── identify.js          ← Equipment vision identification
│       ├── transcribe.js        ← Whisper voice-to-text
│       ├── sessions.js          ← Workout session CRUD
│       ├── profile.js           ← Profile CRUD + avatar
│       ├── subscription.js      ← Stripe checkout + webhook
│       ├── programs.js          ← Program catalogue
│       ├── metrics.js           ← Activity metrics
│       └── tracker.js           ← Workout tracker stats
│
├── Testing/                     ← Project-local tests (vitest)
│   ├── unit/shared.test.js
│   ├── integration/auth.test.js
│   ├── integration/sessions.test.js
│   └── package.json
│
└── CLAUDE.md                    ← Claude Code project rules

spotme-testing/                  ← Dedicated testing workspace
├── sonar-project.properties     ← SonarQube scanner config
├── server/
│   ├── routes/                  ← Mirror of spotme/server/routes (for test imports)
│   ├── db.js
│   ├── package.json
│   ├── vitest.config.js
│   └── tests/
│       ├── helpers/
│       │   ├── in-memory-db.js  ← sql.js in-memory DB + schema + reset()
│       │   └── make-app.js      ← Express app factory for tests
│       ├── integration/
│       │   ├── auth.test.js     ← Full auth flow integration tests
│       │   └── sessions.test.js ← Session CRUD integration tests
│       ├── unit/
│       │   └── shared.test.js   ← Unit tests for shared utilities
│       ├── k6/
│       │   ├── smoke.js         ← Sanity check (1 VU)
│       │   ├── load.js          ← Normal load (50 VUs)
│       │   ├── stress.js        ← Breaking point (200 VUs)
│       │   ├── spike.js         ← Sudden burst (300 VUs in 10 s) ← NEW
│       │   ├── volume.js        ← Data volume (2,000 sessions)   ← NEW
│       │   ├── endurance.js     ← Soak test (30 min)             ← NEW
│       │   └── reports/         ← JSON output from k6 runs
│       └── docs/
│           ├── TEST_PLAN.md
│           ├── TRACEABILITY_MATRIX.md
│           ├── DEFECT_LOG.md
│           └── FULL_PROJECT_REPORT.md ← This file
└── selenium/
    ├── package.json
    ├── helpers/driver.js        ← WebDriver factory + helper functions
    └── tests/
        ├── auth.test.js         ← TC-A01–A11: auth flow E2E
        ├── chat.test.js         ← TC-C01–C08: chat UI E2E
        └── settings.test.js     ← TC-S01–S10: theme + settings E2E
```

---

## 7. Known Issues & Status

| ID | Area | Issue | Status |
|----|------|-------|--------|
| BUG-001 | Auth | Google OAuth `redirect_uri_mismatch` — URI not registered in Google Cloud Console | **Action required:** Add `http://localhost:8787/api/auth/google/callback` to authorized URIs |
| BUG-002 | Stripe | `STRIPE_SECRET_KEY` is placeholder — payments not functional | **Action required:** Add real Stripe test keys to `.env` |
| BUG-003 | Security | `SESSION_SECRET` is `"change-me-for-local-dev"` | **Action required:** Set a strong random secret before any public deployment |
| INFO-001 | Tracker | TrackerPage UI is a stub — backend API is complete | Backlog |
| INFO-002 | Notifications | Bell icon notification system is wired but shows mock data | Backlog |

---

## 8. Possible Presentation Questions & Answers

**Q1: Why did you use React via CDN Babel instead of a proper build tool like Vite?**
A: For rapid development without a build pipeline. Since this is a demo/MVP, the zero-config approach (just open `index.html`) lets any contributor run the frontend instantly without `npm install` or bundler configuration. The tradeoff is slower initial load in production (in-browser Babel) — for a production release we would switch to a Vite build outputting pre-compiled bundles.

**Q2: Why SQLite and not PostgreSQL or MongoDB?**
A: SQLite requires zero infrastructure — no separate database server to run, configure, or back up during development. It's stored in a single file (`spotme.sqlite`), making the project portable. It handles the expected load well (hundreds of concurrent users with connection pooling). For a production scale-out, we would migrate to PostgreSQL using the same sql.js SQL dialect.

**Q3: How is user data protected?**
A:
- Passwords are bcrypt-hashed at cost 11 (≈ 100 ms per hash, brute-force resistant)
- Tokens are 32-byte random hex (256-bit entropy), stored server-side, expire after 30 days
- All API responses go through `publicUser()` which strips `password_hash` from payloads
- HTTPS headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`
- Stripe webhooks verified with signature (`STRIPE_WEBHOOK_SECRET`)
- Google OAuth uses CSRF state parameter (10-minute expiry, in-memory map)

**Q4: How does the AI streaming work?**
A: The client sends a POST to `/api/chat/stream`. The server calls Groq's streaming API with `stream: true`, which returns an `async iterable` of chunks. The server pipes each chunk to the HTTP response using Server-Sent Events (SSE) format (`data: <json>\n\n`). The frontend uses `fetch` + `ReadableStream` to consume the SSE and appends each token to the message bubble in real time.

**Q5: What does the k6 spike test measure specifically?**
A: It simulates a viral moment — the server goes from 5 idle users to 300 users in 10 seconds. We're looking for: (1) no connection refused (server must not crash), (2) the error rate stays under 15% at peak, and (3) once the spike ends, latency recovers to normal levels within 60 seconds. This tests Node.js's event loop under sudden queue buildup and bcrypt's blocking behavior.

**Q6: Why does signup dominate latency in load tests?**
A: `bcrypt.hash(password, 11)` is deliberately slow (~100 ms) to resist brute-force attacks. Under load with 50 concurrent signups, they queue on Node's thread pool (libuv default: 4 threads). The p95 signup latency of ~300 ms reflects this. Mitigation: increase `UV_THREADPOOL_SIZE`, use a worker pool, or reduce bcrypt cost to 10 for load tests.

**Q7: Why use Groq instead of OpenAI?**
A: Groq's free tier allows 30 requests/minute and 14,400 requests/day with no credit card required. This makes it ideal for a development project. The Llama 3.3-70b model matches GPT-4 quality for fitness coaching tasks. The API is fully OpenAI-compatible, so switching providers requires only changing the base URL and API key.

**Q8: What happens if the AI API is unavailable?**
A: The server returns a 503 with `{ error: "AI service unavailable" }`. The frontend catches non-2xx responses and displays the error message in the chat bubble instead of crashing. The streaming parser is defensive — any malformed SSE chunk is skipped without breaking the stream.

**Q9: How does the theme system work technically?**
A: The theme is stored in `localStorage` as `spotme-theme` and applied by setting `data-theme="light"` on `<html>`. All colors use CSS custom properties (`var(--bg-page)`, `var(--ink-1)`, `var(--acc-mint)` etc.). Light mode is achieved by a single `[data-theme="light"] { }` block overriding these variables — all components automatically adapt since they reference the variables. No JavaScript component re-rendering is needed for theme changes.

**Q10: How would you scale this for 10,000 concurrent users?**
A:
1. Replace SQLite with PostgreSQL (connection pooling with pg-pool)
2. Add Redis for session tokens (O(1) lookup instead of SQL query)
3. Put bcrypt hashing in a worker thread pool
4. Add a load balancer (nginx) in front of multiple Node instances
5. Serve static assets from CDN (Cloudflare)
6. Rate-limit AI endpoints per user (1 req/s via a Redis sliding window)
7. Add horizontal autoscaling (Kubernetes HPA on CPU/memory metrics)

---

*Report generated: 2026-04-29 | SpotMe v1.0.0*
