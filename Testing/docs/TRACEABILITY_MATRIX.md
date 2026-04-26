# Requirements Traceability Matrix — SpotMe API

Maps each functional requirement to its test case(s), technique applied, and current status.

| Req ID | Requirement | Test ID | Technique | File | Status |
|--------|-------------|---------|-----------|------|--------|
| **AUTH** | | | | | |
| R-AUTH-01 | Signup creates account with hashed password, returns token + public user | UC-002 | EP | auth.test.js | ✅ |
| R-AUTH-02 | Duplicate email returns 409 | DT-001 | EP, DT | auth.test.js | ✅ |
| R-AUTH-03 | Duplicate email check is case-insensitive | DT-001b | EP | auth.test.js | ✅ |
| R-AUTH-04 | password_hash never returned in API response | UC-002 | WB | auth.test.js | ✅ |
| R-AUTH-05 | Password must be ≥ 12 chars | BVA-11, BVA-12 | BVA | auth.test.js | ✅ |
| R-AUTH-06 | Password must have lower + upper + digit + symbol | EP-pw-lower, etc | EP | auth.test.js | ✅ |
| R-AUTH-07 | firstName/lastName: letters/spaces/hyphens/apostrophes only | EP-invalid-name | EP | auth.test.js | ✅ |
| R-AUTH-08 | firstName === lastName → validation error | DT-002 | DT | auth.test.js | ✅ |
| R-AUTH-09 | weight must be 0 < w ≤ 500 | BVA-weight | BVA | auth.test.js | ✅ |
| R-AUTH-10 | height must be 0 < h ≤ 300 | BVA-height | BVA | auth.test.js | ✅ |
| R-AUTH-11 | level must be beginner/intermediate/pro | EP-invalid-level | EP | auth.test.js | ✅ |
| R-AUTH-12 | Login: correct credentials return token | DT-003-row1 | DT | auth.test.js | ✅ |
| R-AUTH-13 | Login: wrong password returns 401 | DT-003-row2 | DT | auth.test.js | ✅ |
| R-AUTH-14 | Login: unknown email returns 401 (timing-safe) | DT-003-row3 | DT | auth.test.js | ✅ |
| R-AUTH-15 | Login: missing password returns 400 | DT-003-row4 | DT | auth.test.js | ✅ |
| R-AUTH-16 | Login: invalid email format returns 400 | DT-003-row5 | DT | auth.test.js | ✅ |
| R-AUTH-17 | GET /me with valid token returns user | UC-003 | ST | auth.test.js | ✅ |
| R-AUTH-18 | GET /me with no token returns 401 | EP-no-auth | EP | auth.test.js | ✅ |
| R-AUTH-19 | GET /me with bogus token returns 401 | EP-bad-token | EP | auth.test.js | ✅ |
| R-AUTH-20 | GET /me with malformed header returns 401 | EP-malformed | EP | auth.test.js | ✅ |
| R-AUTH-21 | Logout invalidates token | UC-004 | ST | auth.test.js | ✅ |
| R-AUTH-22 | After logout, token no longer valid for /me | UC-004b | ST | auth.test.js | ✅ |
| R-AUTH-23 | Delete account; subsequent login returns 401 | UC-005 | ST | auth.test.js | ✅ |
| R-AUTH-24 | Full lifecycle state machine | ST-001 | ST | auth.test.js | ✅ |
| **SESSIONS** | | | | | |
| R-SES-01 | List sessions returns empty array when none exist | EP-empty | EP | sessions.test.js | ✅ |
| R-SES-02 | List sessions returns user's sessions | UC-010 | UC | sessions.test.js | ✅ |
| R-SES-03 | List sessions only returns own data | EP-isolation | EP | sessions.test.js | ✅ |
| R-SES-04 | Session response has required fields | UC-010b | WB | sessions.test.js | ✅ |
| R-SES-05 | GET session by ID returns session + messages | UC-011 | UC | sessions.test.js | ✅ |
| R-SES-06 | GET non-existent session returns 404 | EP-not-found | EP | sessions.test.js | ✅ |
| R-SES-07 | GET another user's session returns 404 | EP-isolation | EP | sessions.test.js | ✅ |
| R-SES-08 | GET session with non-integer ID returns 400 | BVA-non-int | BVA | sessions.test.js | ✅ |
| R-SES-09 | PATCH session renames it | UC-012 | UC | sessions.test.js | ✅ |
| R-SES-10 | PATCH session with empty title returns 400 | BVA-empty | BVA | sessions.test.js | ✅ |
| R-SES-11 | PATCH title truncated to 120 chars | BVA-max-length | BVA | sessions.test.js | ✅ |
| R-SES-12 | DELETE session; GET returns 404 | UC-013 | ST | sessions.test.js | ✅ |
| R-SES-13 | DELETE non-existent session returns 404 | EP-not-found | EP | sessions.test.js | ✅ |
| **PROFILE** | | | | | |
| R-PRO-01 | PATCH profile updates specified fields | UC-020 | UC | sessions.test.js | ✅ |
| R-PRO-02 | PATCH profile: omitted fields unchanged | UC-020b | EP | sessions.test.js | ✅ |
| R-PRO-03 | PATCH profile: invalid firstName returns 400 | EP-invalid-name | EP | sessions.test.js | ✅ |
| R-PRO-04 | PATCH profile: invalid weight unit returns 400 | EP-invalid-unit | EP | sessions.test.js | ✅ |
| R-PRO-05 | PATCH profile: weight > 500 returns 400 | BVA-501 | BVA | sessions.test.js | ✅ |
| R-PRO-06 | PATCH profile: avatarUrl must be data:image/ | EP-avatar | EP | sessions.test.js | ✅ |
| R-PRO-07 | POST /profile/upgrade returns 501 | UC-021 | UC | sessions.test.js | ✅ |
| **MIDDLEWARE** | | | | | |
| R-MW-01 | requireAuth: missing header → 401 | WB-requireAuth | WB | shared.test.js | ✅ |
| R-MW-02 | requireAuth: non-Bearer header → 401 | WB-requireAuth | WB | shared.test.js | ✅ |
| R-MW-03 | requireAuth: unknown token → 401 | WB-requireAuth | WB | shared.test.js | ✅ |
| R-MW-04 | requireAuth: expired token → 401 + delete token | WB-requireAuth | WB | shared.test.js | ✅ |
| R-MW-05 | requireAuth: user not found → 401 | WB-requireAuth | WB | shared.test.js | ✅ |
| R-MW-06 | requireAuth: valid token attaches req.user | WB-requireAuth | WB | shared.test.js | ✅ |
| **UTILITY** | | | | | |
| R-UT-01 | publicUser strips password_hash and timestamps | WB-publicUser | WB | shared.test.js | ✅ |
| R-UT-02 | publicUser maps snake_case → camelCase | WB-publicUser | WB | shared.test.js | ✅ |
| R-UT-03 | publicUser(null) returns null | WB-publicUser | WB | shared.test.js | ✅ |
| R-UT-04 | newToken generates 64-char hex string | WB-newToken | WB | shared.test.js | ✅ |
| R-UT-05 | newToken generates unique values | WB-newToken | WB | shared.test.js | ✅ |
| R-UT-06 | ApiError stores status + message | WB-ApiError | WB | shared.test.js | ✅ |
| **PERFORMANCE** | | | | | |
| R-PERF-01 | p95 latency < 200 ms at 50 VUs | LOAD-p95 | Load | k6/load.js | ⬜ |
| R-PERF-02 | Error rate < 1% at 50 VUs | LOAD-err | Load | k6/load.js | ⬜ |
| R-PERF-03 | Server survives 200 VU spike | STRESS-200 | Stress | k6/stress.js | ⬜ |
| R-PERF-04 | Smoke: all critical paths work | SMOKE-001 | Smoke | k6/smoke.js | ⬜ |

**Legend:** ✅ Implemented · ⬜ Pending execution · ❌ Failed · 🔄 Blocked

---

## Boundary Value Summary

| Field | Lower Boundary | At Lower | Above Lower | Upper Boundary | At Upper | Above Upper |
|---|---|---|---|---|---|---|
| password length | 12 | 200 ✅ | 201 ✅ | — | — | — |
| weight | 0 | 400 ✅ | 200 ✅ | 500 | 200 ✅ | 400 ✅ |
| height | 0 | 400 | 200 | 300 | 200 ✅ | 400 ✅ |
| session title length | 1 | 200 ✅ | 200 ✅ | 120 (truncate) | 200 ✅ | — |

---

## Decision Table: Login (DT-003)

| Email valid | User exists | Password correct | Expected |
|---|---|---|---|
| ✓ | ✓ | ✓ | 200 + token |
| ✓ | ✓ | ✗ | 401 |
| ✓ | ✗ | n/a | 401 |
| ✗ | n/a | n/a | 400 |
| ✓ | ✓ (OAuth) | n/a | 401 (no password hash) |
