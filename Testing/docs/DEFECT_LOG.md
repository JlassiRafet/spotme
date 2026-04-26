# SpotMe — Defect Log

Bug tracking for the SpotMe API test suite.
Each entry follows the standard defect report format.

---

## Template

```
### BUG-XXX: [Short title]

| Field | Value |
|---|---|
| ID | BUG-XXX |
| Severity | Critical / High / Medium / Low |
| Priority | P1 / P2 / P3 / P4 |
| Status | Open / In Progress / Fixed / Closed / Won't Fix |
| Reporter | [Name] |
| Date Found | YYYY-MM-DD |
| Date Fixed | YYYY-MM-DD |
| Env | Node v24, Windows 11, sql.js 1.11 |
| Test Case | [Test ID from traceability matrix] |

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** 
**Actual:** 

**Root Cause:** 
**Fix:** 
```

---

## Active Bugs

_No active bugs at this time._

---

## Resolved Bugs

### BUG-001: Error handler sends full error message for 5xx responses

| Field | Value |
|---|---|
| ID | BUG-001 |
| Severity | Medium |
| Priority | P2 |
| Status | Fixed |
| Reporter | Security audit |
| Date Found | 2026-04-20 |
| Date Fixed | 2026-04-20 |
| Env | All environments |
| Test Case | EP-server-error |

**Steps to Reproduce:**
1. Trigger an unhandled exception inside a route handler.
2. Observe the JSON error response body.

**Expected:** `{ "error": "Internal server error" }` — generic message for 5xx.
**Actual:** `{ "error": "<full exception message with stack details>" }` — leaked internals.

**Root Cause:** Error handler used `err.message` unconditionally.
**Fix:** `status < 500 ? (err.message || 'Request failed') : 'Internal server error'`

---

### BUG-002: bcrypt DoS — no password length cap

| Field | Value |
|---|---|
| ID | BUG-002 |
| Severity | High |
| Priority | P1 |
| Status | Fixed |
| Reporter | Security review |
| Date Found | 2026-04-20 |
| Date Fixed | 2026-04-20 |
| Env | Production |
| Test Case | EP-invalid-password |

**Steps to Reproduce:**
1. POST `/api/auth/signup` with a password 10,000 characters long.
2. Server attempts bcrypt hash — process hangs for seconds per request.
3. Flood with 10 concurrent requests — server becomes unresponsive.

**Expected:** Immediate 400 rejection for passwords over a safe maximum length.
**Actual:** Server hangs trying to hash an enormous string.

**Root Cause:** bcrypt's cost factor makes long-string hashing O(n) in password length.
**Fix:** Added `else if (body.password.length > 72) { errors.password = 'Password is too long (max 72 characters).' }` before bcrypt call.

---

### BUG-003: OAuth CSRF state not validated

| Field | Value |
|---|---|
| ID | BUG-003 |
| Severity | High |
| Priority | P1 |
| Status | Fixed |
| Reporter | Security review |
| Date Found | 2026-04-20 |
| Date Fixed | 2026-04-20 |
| Env | Production |
| Test Case | ST-oauth-csrf |

**Steps to Reproduce:**
1. Initiate Google OAuth flow.
2. Attacker intercepts callback URL and replaces `state` parameter with arbitrary value.
3. Server accepts the forged callback and logs in attacker.

**Expected:** Invalid `state` parameter redirects to `/?auth_error=invalid_state`.
**Actual:** (pre-fix) State was not validated — any callback was accepted.

**Root Cause:** OAuth state parameter was generated but never verified on callback.
**Fix:** Added in-memory `oauthStates` Map with 10-minute TTL; state verified and deleted on callback.

---

## Execution Log

| Date | Test Suite | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 2026-04-26 | unit/shared.test.js | — | — | — | Pending first run |
| 2026-04-26 | integration/auth.test.js | — | — | — | Pending first run |
| 2026-04-26 | integration/sessions.test.js | — | — | — | Pending first run |
| — | k6/smoke.js | — | — | — | Pending server start |
| — | k6/load.js | — | — | — | Pending server start |
| — | k6/stress.js | — | — | — | Pending server start |

---

## Severity Definitions

| Level | Description |
|---|---|
| Critical | Data loss, security breach, complete feature failure |
| High | Core functionality broken, no workaround |
| Medium | Feature impaired, workaround exists |
| Low | Cosmetic, edge case with minimal impact |

## Priority Definitions

| Level | SLA |
|---|---|
| P1 | Fix within 24 hours |
| P2 | Fix within 3 days |
| P3 | Fix in next sprint |
| P4 | Backlog |
