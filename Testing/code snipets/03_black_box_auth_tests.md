# Black-Box Integration Tests — Auth Routes

**File:** `Testing/integration/auth.test.js`  
**Techniques:** Equivalence Partitioning, Boundary Value Analysis, Decision Tables, State-Transition  

---

## 1. Test Setup — In-Memory DB Mock

```javascript
// Mock server's db.js with a real in-memory sql.js database
vi.mock('../../server/db.js', async () => {
  const mod = await import('../helpers/in-memory-db.js');
  await mod.init();  // initialize WASM sql.js
  return { stmts: mod.stmts, db: mod.db };
});

import { reset } from '../helpers/in-memory-db.js';
import { makeApp } from '../helpers/make-app.js';

let app;
beforeAll(() => { app = makeApp(); });
beforeEach(() => reset());  // fresh DB before each test
```

---

## 2. Equivalence Partitioning — Signup Valid/Invalid

```javascript
const VALID_USER = {
  email: 'alice@example.com', password: 'AlicePass1!safe',
  firstName: 'Alice', lastName: 'Smith',
};

// EP: Valid partition → 200 + token
it('creates account and returns token + user (UC-002)', async () => {
  const res = await request(app).post('/api/auth/signup').send(VALID_USER);
  expect(res.status).toBe(200);
  expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  expect(res.body.user.email).toBe('alice@example.com');
  expect(res.body.user.password_hash).toBeUndefined(); // never exposed
});

// EP: Invalid partition — digits in name
it('400 on firstName with digits (EP-invalid-name)', async () => {
  const res = await request(app).post('/api/auth/signup')
    .send({ ...VALID_USER, firstName: 'Al1ce' });
  expect(res.status).toBe(400);
  const body = JSON.parse(res.body.error);
  expect(body.fieldErrors?.firstName).toBeTruthy();
});

// EP: Invalid partition — same first/last name
it('400 when firstName === lastName (DT-002)', async () => {
  const res = await request(app).post('/api/auth/signup')
    .send({ ...VALID_USER, firstName: 'Same', lastName: 'Same' });
  expect(res.status).toBe(400);
});
```

---

## 3. Boundary Value Analysis — Password Length

```javascript
describe('BVA password length', () => {
  // Below boundary: 11 chars → reject
  it('400 for password of exactly 11 chars (below boundary)', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ ...VALID_USER, password: 'Short1!xxxx' }); // 11 chars
    expect(res.status).toBe(400);
  });

  // At boundary: 12 chars → accept
  it('200 for password of exactly 12 chars (at boundary)', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ ...VALID_USER, password: 'ShortPass1!x' }); // 12 chars
    expect(res.status).toBe(200);
  });
});
```

---

## 4. Boundary Value Analysis — Weight Field

```javascript
describe('BVA weight/height', () => {
  it('200 for weight at boundary 500',     async () => {
    expect((await signup({ weight: 500 })).status).toBe(200);
  });
  it('400 for weight above boundary 501',  async () => {
    expect((await signup({ weight: 501 })).status).toBe(400);
  });
  it('400 for weight of 0 (lower boundary)', async () => {
    expect((await signup({ weight: 0 })).status).toBe(400);
  });
  it('400 for negative weight',            async () => {
    expect((await signup({ weight: -1 })).status).toBe(400);
  });
  it('200 for height at boundary 300',     async () => {
    expect((await signup({ height: 300 })).status).toBe(200);
  });
  it('400 for height above boundary 301',  async () => {
    expect((await signup({ height: 301 })).status).toBe(400);
  });
});
```

---

## 5. Decision Table — Login (DT-003)

```javascript
// Decision Table: email valid × user exists × password correct
describe('POST /api/auth/login — Decision Table (DT-003)', () => {
  beforeEach(async () => { await signup(); }); // seed a user

  // Row 1: valid email, user exists, correct password → 200
  it('returns token on correct credentials', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  // Row 2: valid email, user exists, WRONG password → 401
  it('401 on wrong password', async () => {
    expect((await login(VALID_USER.email, 'WrongPass99!')).status).toBe(401);
  });

  // Row 3: valid email, user NOT found → 401 (timing-safe)
  it('401 on unknown email', async () => {
    expect((await login('nobody@x.com', VALID_USER.password)).status).toBe(401);
  });

  // Row 4: no password → 400
  it('400 when password omitted', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: VALID_USER.email });
    expect(res.status).toBe(400);
  });

  // Row 5: invalid email format → 400
  it('400 when email is not valid format', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'badformat', password: VALID_USER.password });
    expect(res.status).toBe(400);
  });
});
```

---

## 6. State-Transition Testing — Full Lifecycle (ST-001)

```javascript
describe('State-Transition: full user lifecycle', () => {
  it('unregistered → signup → login → logout → login → delete (ST-001)', async () => {
    // State 1: unauthenticated
    let res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);

    // State 2 → 3: signup + authenticated
    res = await signup();
    expect(res.status).toBe(200);
    const token1 = res.body.token;

    res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);

    // State 4: logout → unauthenticated
    await request(app).post('/api/auth/logout')
      .set('Authorization', `Bearer ${token1}`);
    res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(401);  // token invalidated

    // State 5 → 6: login again
    res = await login();
    expect(res.status).toBe(200);
    const token2 = res.body.token;

    // State 7: delete account
    await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${token2}`);

    // State 8: login after delete → 401
    res = await login();
    expect(res.status).toBe(401);
  });
});
```
