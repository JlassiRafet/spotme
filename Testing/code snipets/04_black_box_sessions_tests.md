# Black-Box Integration Tests — Sessions & Profile Routes

**File:** `Testing/integration/sessions.test.js`  
**Techniques:** EP, BVA, State-Transition, Use-Case Scenarios  

---

## 1. Test Setup — Seeding a User Directly

```javascript
// Seed a user + valid token directly into the in-memory DB
// (avoids going through the signup endpoint every test)
beforeEach(async () => {
  reset();  // fresh DB
  const nowSec = Math.floor(Date.now() / 1000);
  const info = stmts.insertUser.run({
    email: 'test@spotme.io', password_hash: '$2a$11$placeholder',
    first_name: 'Test', last_name: 'User',
    level: 'beginner', weight: 75, weight_unit: 'kg',
    height: 180, height_unit: 'cm',
    // ... other nullable fields ...
  });
  userId = info.lastInsertRowid;
  token = 'test-token-abcdef1234567890';
  stmts.insertToken.run(token, userId, nowSec + 3600);
});

function auth() {
  return { Authorization: `Bearer ${token}` };
}
```

---

## 2. EP — Data Isolation Between Users

```javascript
it('only returns own sessions (EP-isolation)', async () => {
  // Create a second user with their own session
  const other = stmts.insertUser.run({ email: 'other@x.com', ... });
  stmts.createSession.run(other.lastInsertRowid, 'Other session', '');
  stmts.createSession.run(userId, 'My session', '');

  const res = await request(app).get('/api/sessions').set(auth());
  
  // User can only see their own sessions
  expect(res.body.sessions.length).toBe(1);
  expect(res.body.sessions[0].title).toBe('My session');
});
```

---

## 3. BVA — Title Boundary at 120 Characters

```javascript
it('truncates title to 120 chars (BVA-max-length)', async () => {
  const longTitle = 'A'.repeat(200);  // well above boundary
  const res = await request(app).patch(`/api/sessions/${sessionId}`)
    .set(auth()).send({ title: longTitle });
  expect(res.status).toBe(200);
  expect(res.body.title.length).toBe(120);  // truncated at 120
});

it('400 when title is empty (BVA-empty-string)', async () => {
  const res = await request(app).patch(`/api/sessions/${sessionId}`)
    .set(auth()).send({ title: '' });
  expect(res.status).toBe(400);
});
```

---

## 4. State-Transition — Session Lifecycle (UC-013)

```javascript
it('deletes session; subsequent GET returns 404 (UC-013)', async () => {
  // State: session exists
  const del = await request(app)
    .delete(`/api/sessions/${sessionId}`)
    .set(auth());
  expect(del.status).toBe(200);
  expect(del.body.ok).toBe(true);

  // State: session deleted → 404
  const get = await request(app)
    .get(`/api/sessions/${sessionId}`)
    .set(auth());
  expect(get.status).toBe(404);
});
```

---

## 5. Profile Update — Partial Update Semantics

```javascript
it('partial update: omitted fields stay unchanged', async () => {
  // Only send weight — firstName must remain 'Test'
  const res = await request(app).patch('/api/profile')
    .set(auth()).send({ weight: 90 });
  expect(res.status).toBe(200);
  expect(res.body.user.firstName).toBe('Test');  // unchanged
  expect(res.body.user.weight).toBe(90);          // updated
});
```

---

## 6. Profile Validation — EP Invalid Fields

```javascript
it('400 for invalid firstName (EP-invalid-name)', async () => {
  const res = await request(app).patch('/api/profile')
    .set(auth()).send({ firstName: 'T3st123' });  // contains digits
  expect(res.status).toBe(400);
});

it('400 for avatarUrl that is not a data:image/ URL', async () => {
  const res = await request(app).patch('/api/profile')
    .set(auth()).send({ avatarUrl: 'https://evil.com/x.jpg' });
  expect(res.status).toBe(400);
});
```

---

## 7. Upgrade — Stripe checkout (or 503 if not configured)

```javascript
it('returns Stripe checkout URL when payment is configured, otherwise 503', async () => {
  const res = await request(app).post('/api/profile/upgrade').set(auth());
  expect([200, 503]).toContain(res.status);
  if (res.status === 503) {
    expect(String(res.body.error || '')).toMatch(/not configured|Payment/i);
  } else {
    expect(res.body.url).toMatch(/^https:\/\//);
  }
});
```
