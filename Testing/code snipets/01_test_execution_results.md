# Test Execution Results — SpotMe API

**Date:** 2026-04-26  
**Tool:** Vitest v2.1.9  
**Location:** `spotme/Testing/`  
**Command:** `npm test -- --reporter=verbose`

---

## Summary

```
 Test Files  3 passed (3)
      Tests  74 passed (74)
   Start at  17:52:21
   Duration  3.39s
```

---

## Full Verbose Output

```
 ✓ unit/shared.test.js > ApiError > stores status and message
 ✓ unit/shared.test.js > ApiError > inherits from Error
 ✓ unit/shared.test.js > newToken > returns a 64-char hex string
 ✓ unit/shared.test.js > newToken > returns a different value each call
 ✓ unit/shared.test.js > publicUser > strips password_hash and timestamps
 ✓ unit/shared.test.js > publicUser > maps snake_case to camelCase
 ✓ unit/shared.test.js > publicUser > returns null for null input
 ✓ unit/shared.test.js > publicUser > preserves id, email, plan
 ✓ unit/shared.test.js > requireAuth middleware > calls next(ApiError 401) when Authorization header is missing
 ✓ unit/shared.test.js > requireAuth middleware > calls next(ApiError 401) when header is not Bearer format
 ✓ unit/shared.test.js > requireAuth middleware > calls next(ApiError 401) when token is not in DB
 ✓ unit/shared.test.js > requireAuth middleware > deletes expired token and calls next(ApiError 401)
 ✓ unit/shared.test.js > requireAuth middleware > calls next(ApiError 401) when user no longer exists
 ✓ unit/shared.test.js > requireAuth middleware > attaches req.user and req.token on success and calls next()
 ✓ integration/sessions.test.js > GET /api/sessions > returns empty array when no sessions exist (EP-empty)
 ✓ integration/sessions.test.js > GET /api/sessions > returns list with created sessions (UC-010)
 ✓ integration/sessions.test.js > GET /api/sessions > 401 without auth
 ✓ integration/sessions.test.js > GET /api/sessions > only returns own sessions (EP-isolation)
 ✓ integration/sessions.test.js > GET /api/sessions > response shape includes expected fields
 ✓ integration/sessions.test.js > GET /api/sessions/:id > returns session + messages (UC-011)
 ✓ integration/sessions.test.js > GET /api/sessions/:id > 404 for non-existent session (EP-not-found)
 ✓ integration/sessions.test.js > GET /api/sessions/:id > 404 for another user's session (EP-isolation)
 ✓ integration/sessions.test.js > GET /api/sessions/:id > 400 for invalid id format (BVA-non-integer)
 ✓ integration/auth.test.js > GET /api/health > returns ok:true (UC-001)
 ✓ integration/sessions.test.js > PATCH /api/sessions/:id (rename) > renames session and returns new title (UC-012)
 ✓ integration/sessions.test.js > PATCH /api/sessions/:id (rename) > 400 when title is empty (BVA-empty-string)
 ✓ integration/sessions.test.js > PATCH /api/sessions/:id (rename) > 404 for non-existent session
 ✓ integration/sessions.test.js > PATCH /api/sessions/:id (rename) > truncates title to 120 chars (BVA-max-length)
 ✓ integration/sessions.test.js > DELETE /api/sessions/:id (ST) > deletes session; subsequent GET returns 404 (UC-013)
 ✓ integration/sessions.test.js > DELETE /api/sessions/:id (ST) > 404 on deleting non-existent session
 ✓ integration/sessions.test.js > DELETE /api/sessions/:id (ST) > 404 on deleting another user's session
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > updates profile fields and returns updated user
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > partial update: omitted fields stay unchanged
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > 400 for invalid firstName (EP-invalid-name)
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > 400 for invalid weight unit
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > 400 for invalid level
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > 400 for weight above boundary (BVA-501)
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > 400 for avatarUrl that is not a data:image/ URL
 ✓ integration/sessions.test.js > PATCH /api/profile (UC-020) > 401 without auth
 ✓ integration/sessions.test.js > POST /api/profile/upgrade (UC-021) > returns 501 — upgrade not yet implemented
 ✓ integration/sessions.test.js > POST /api/profile/upgrade (UC-021) > 401 without auth
 ✓ integration/auth.test.js > POST /api/auth/signup — EP valid partition > creates account and returns token + user (UC-002)
 ✓ integration/auth.test.js > POST /api/auth/signup — EP valid partition > includes profile fields in response
 ✓ integration/auth.test.js > POST /api/auth/signup — EP duplicate email (DT-001) > returns 409 on duplicate email
 ✓ integration/auth.test.js > POST /api/auth/signup — EP duplicate email (DT-001) > is case-insensitive on duplicate check
 ✓ integration/auth.test.js > POST /api/auth/signup — EP invalid fields > 400 on missing email (EP-invalid-email)
 ✓ integration/auth.test.js > POST /api/auth/signup — EP invalid fields > 400 on invalid email missing @
 ✓ integration/auth.test.js > POST /api/auth/signup — EP invalid fields > 400 on firstName with digits (EP-invalid-name)
 ✓ integration/auth.test.js > POST /api/auth/signup — EP invalid fields > 400 when firstName === lastName (DT-002)
 ✓ integration/auth.test.js > POST /api/auth/signup — EP invalid fields > 400 on invalid experience level (EP-invalid-level)
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA password length > 400 for password of exactly 11 chars (below boundary)
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA password length > 200 for password of exactly 12 chars (at boundary)
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA password length > 400 for password with no uppercase
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA password length > 400 for password with no digit
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA password length > 400 for password with no symbol
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA weight/height > 200 for weight at boundary 500
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA weight/height > 400 for weight above boundary 501
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA weight/height > 400 for weight of 0 (lower boundary)
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA weight/height > 400 for negative weight
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA weight/height > 200 for height at boundary 300
 ✓ integration/auth.test.js > POST /api/auth/signup — BVA weight/height > 400 for height above boundary 301
 ✓ integration/auth.test.js > POST /api/auth/login — Decision Table (DT-003) > returns token on correct credentials
 ✓ integration/auth.test.js > POST /api/auth/login — Decision Table (DT-003) > 401 on wrong password
 ✓ integration/auth.test.js > POST /api/auth/login — Decision Table (DT-003) > 401 on unknown email
 ✓ integration/auth.test.js > POST /api/auth/login — Decision Table (DT-003) > 400 when password omitted
 ✓ integration/auth.test.js > POST /api/auth/login — Decision Table (DT-003) > 400 when email is not valid format
 ✓ integration/auth.test.js > GET /api/auth/me (ST: authenticated state) > returns user when token is valid (UC-003)
 ✓ integration/auth.test.js > GET /api/auth/me (ST: authenticated state) > 401 with no token
 ✓ integration/auth.test.js > GET /api/auth/me (ST: authenticated state) > 401 with bogus token
 ✓ integration/auth.test.js > GET /api/auth/me (ST: authenticated state) > 401 with malformed Authorization header
 ✓ integration/auth.test.js > POST /api/auth/logout (ST) > invalidates token so /me returns 401 afterwards (UC-004)
 ✓ integration/auth.test.js > POST /api/auth/logout (ST) > 401 when no token provided to logout
 ✓ integration/auth.test.js > DELETE /api/auth/account (ST: account deleted) > deletes account; subsequent login returns 401 (UC-005)
 ✓ integration/auth.test.js > State-Transition: full user lifecycle > unregistered → signup → login → logout → login → delete (ST-001)

 Test Files  3 passed (3)
      Tests  74 passed (74)
   Duration  3.39s
```

---

## Breakdown by File

| File | Tests | Duration |
|---|---|---|
| `unit/shared.test.js` | 14 passed | 8 ms |
| `integration/sessions.test.js` | 26 passed | 207 ms |
| `integration/auth.test.js` | 34 passed | 2572 ms |
| **Total** | **74 passed** | **3.39 s** |

> Note: `auth.test.js` is slower because it runs real bcrypt hashing (cost 11) for each signup operation.
