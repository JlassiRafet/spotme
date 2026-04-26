# White-Box Unit Tests — Code Snippets

**File:** `Testing/unit/shared.test.js`  
**Technique:** Statement + Branch Coverage  
**Target:** `server/routes/_shared.js` — ApiError, newToken, publicUser, requireAuth  

---

## 1. Mock Setup with vi.hoisted (ESM-safe)

```javascript
// vi.hoisted ensures mock vars exist BEFORE vi.mock runs (ESM hoisting requirement)
const { mockGetToken, mockGetById, mockDeleteToken } = vi.hoisted(() => ({
  mockGetToken:    vi.fn(),
  mockGetById:     vi.fn(),
  mockDeleteToken: vi.fn(),
}));

vi.mock('../../server/db.js', () => ({
  stmts: {
    getToken:    { get: mockGetToken    },
    getUserById: { get: mockGetById     },
    deleteToken: { run: mockDeleteToken },
  },
  db: { open: true, persist: vi.fn() },
}));
```

---

## 2. ApiError Class Tests

```javascript
describe('ApiError', () => {
  it('stores status and message', () => {
    const e = new ApiError(404, 'Not found');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.message).toBe('Not found');
  });

  it('inherits from Error', () => {
    expect(new ApiError(500, 'x')).toBeInstanceOf(Error);
  });
});
```

---

## 3. newToken Randomness Tests

```javascript
describe('newToken', () => {
  it('returns a 64-char hex string', () => {
    const t = newToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a different value each call', () => {
    expect(newToken()).not.toBe(newToken());
  });
});
```

---

## 4. publicUser Field Projection (White-Box)

```javascript
describe('publicUser', () => {
  const rawUser = {
    id: 1, email: 'a@b.com',
    password_hash: '$2a$11$xxxxx',         // must be stripped
    first_name: 'Alice', last_name: 'Smith',
    created_at: 1700000000,                // must be stripped
    updated_at: 1700000001,                // must be stripped
    plan: 'free', avatar_url: null,
    // ... other fields ...
  };

  it('strips password_hash and timestamps', () => {
    const out = publicUser(rawUser);
    expect(out.password_hash).toBeUndefined();
    expect(out.created_at).toBeUndefined();
    expect(out.updated_at).toBeUndefined();
  });

  it('maps snake_case to camelCase', () => {
    const out = publicUser(rawUser);
    expect(out.firstName).toBe('Alice');     // first_name → firstName
    expect(out.weightUnit).toBe('kg');       // weight_unit → weightUnit
    expect(out.playsSport).toBe('yes');      // plays_sport → playsSport
  });

  it('returns null for null input', () => {
    expect(publicUser(null)).toBeNull();
  });
});
```

---

## 5. requireAuth Middleware — All Branches

```javascript
describe('requireAuth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req  = { headers: {} };
    res  = {};
    next = vi.fn();
    mockGetToken.mockReset();
    mockGetById.mockReset();
  });

  // Branch 1: Missing Authorization header
  it('401 when Authorization header is missing', () => {
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  // Branch 2: Non-Bearer format
  it('401 when header is not Bearer format', () => {
    req.headers.authorization = 'Basic dXNlcjpwYXNz';
    requireAuth(req, res, next);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  // Branch 3: Token not in DB
  it('401 when token is not in DB', () => {
    req.headers.authorization = 'Bearer unknowntoken';
    mockGetToken.mockReturnValue(undefined);
    requireAuth(req, res, next);
    expect(mockGetToken).toHaveBeenCalledWith('unknowntoken');
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  // Branch 4: Expired token → delete + 401
  it('deletes expired token and returns 401', () => {
    const expiredRow = {
      token: 'tok', user_id: 1,
      expires_at: Math.floor(Date.now() / 1000) - 1,  // past
    };
    req.headers.authorization = 'Bearer tok';
    mockGetToken.mockReturnValue(expiredRow);
    requireAuth(req, res, next);
    expect(mockDeleteToken).toHaveBeenCalledWith('tok'); // token deleted
    expect(next.mock.calls[0][0].message).toMatch(/expired/i);
  });

  // Branch 5: Valid token but user deleted
  it('401 when user no longer exists', () => {
    const validRow = { token: 'tok', user_id: 999,
      expires_at: Math.floor(Date.now() / 1000) + 3600 };
    req.headers.authorization = 'Bearer tok';
    mockGetToken.mockReturnValue(validRow);
    mockGetById.mockReturnValue(undefined);  // user gone
    requireAuth(req, res, next);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  // Branch 6: Happy path
  it('attaches req.user and calls next() with no error on success', () => {
    const validRow = { token: 'goodtoken', user_id: 1,
      expires_at: Math.floor(Date.now() / 1000) + 3600 };
    const user = { id: 1, email: 'x@y.com' };
    req.headers.authorization = 'Bearer goodtoken';
    mockGetToken.mockReturnValue(validRow);
    mockGetById.mockReturnValue(user);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();  // no error argument
    expect(req.user).toBe(user);
    expect(req.token).toBe('goodtoken');
  });
});
```
