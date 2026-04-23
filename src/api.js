/* ============================================================
   SpotMe — API client
   Thin wrapper around fetch() that every page imports via
   window.SpotMe.api.

   Responsibilities:
     - Prepend the base URL (server on same origin, so '')
     - Attach `Authorization: Bearer <token>` if logged in
     - Persist the token + user in localStorage (so refresh keeps
       the session)
     - Uniform return shape: { ok, data, error, fieldErrors, status }
       Callers never need to try/catch on the network layer — we
       convert network errors into { ok: false, error: '...' }.

   Not responsibilities:
     - Any UI. This file is pure data.
     - Retry logic. One attempt, one result.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  // Same-origin: the backend serves the frontend from the same port,
  // so '' works and nothing breaks when the dev moves ports around.
  const BASE = '';

  const TOKEN_KEY = 'spotme.token';
  const USER_KEY  = 'spotme.user';

  /* ---------- token + user persistence ---------- */

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
  }
  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else       localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
  function getSavedUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function setSavedUser(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else      localStorage.removeItem(USER_KEY);
    } catch {}
  }

  /* ---------- core request function ---------- */

  async function request(path, { method = 'GET', body = null, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = getToken();
      if (t) headers.Authorization = `Bearer ${t}`;
    }

    let response;
    try {
      response = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      // Network failure, CORS block, server not running — distinct from a 500.
      return {
        ok: false,
        status: 0,
        error: 'Can\'t reach the server. Is it running on http://localhost:8787?'
      };
    }

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { error: text }; }

    if (!response.ok) {
      // The backend serializes per-field errors as:
      //   { error: JSON.stringify({ fieldErrors: {...} }) }
      // We unwrap that here so callers get a clean shape.
      let fieldErrors = null;
      let error = payload?.error || 'Something went wrong.';
      if (typeof error === 'string' && error.startsWith('{')) {
        try {
          const inner = JSON.parse(error);
          if (inner.fieldErrors) {
            fieldErrors = inner.fieldErrors;
            error = 'Please fix the highlighted fields.';
          }
        } catch {}
      }

      // Auth expired — clear saved state so the UI can route back to login.
      if (response.status === 401 && getToken()) {
        setToken(null);
        setSavedUser(null);
      }

      return { ok: false, status: response.status, error, fieldErrors };
    }

    return { ok: true, status: response.status, data: payload };
  }

  /* ---------- auth ---------- */

  async function signup(payload) {
    const r = await request('/api/auth/signup', { method: 'POST', body: payload, auth: false });
    if (r.ok) {
      setToken(r.data.token);
      setSavedUser(r.data.user);
    }
    return r;
  }

  async function login(email, password) {
    const r = await request('/api/auth/login', {
      method: 'POST', body: { email, password }, auth: false
    });
    if (r.ok) {
      setToken(r.data.token);
      setSavedUser(r.data.user);
    }
    return r;
  }

  async function logout() {
    // Fire-and-forget: even if the request fails, we clear locally.
    try { await request('/api/auth/logout', { method: 'POST' }); } catch {}
    setToken(null);
    setSavedUser(null);
  }

  async function me() {
    const r = await request('/api/auth/me');
    if (r.ok) setSavedUser(r.data.user);
    return r;
  }

  /* ---------- chat ---------- */

  function chat({ sessionId, message, imageDataUrl }) {
    return request('/api/chat', {
      method: 'POST',
      body: { sessionId, message, imageDataUrl }
    });
  }

  function identify({ sessionId, imageDataUrl }) {
    return request('/api/identify', {
      method: 'POST',
      body: { sessionId, imageDataUrl }
    });
  }

  /* ---------- sessions (history) ---------- */

  function listSessions() {
    return request('/api/sessions');
  }
  function getSession(id) {
    return request(`/api/sessions/${id}`);
  }
  function deleteSession(id) {
    return request(`/api/sessions/${id}`, { method: 'DELETE' });
  }

  /* ---------- profile ---------- */

  async function updateProfile(patch) {
    const r = await request('/api/profile', { method: 'PATCH', body: patch });
    if (r.ok) setSavedUser(r.data.user);
    return r;
  }

  function requestUpgrade() {
    return request('/api/profile/upgrade', { method: 'POST' });
  }

  /* ---------- health (used by a small status badge, optional) ---------- */

  function health() {
    return request('/api/health', { auth: false });
  }

  /* ---------- expose on window.SpotMe.api ---------- */

  SpotMe.api = {
    // session state
    getToken, getSavedUser,
    // auth
    signup, login, logout, me,
    // chat
    chat, identify,
    // history
    listSessions, getSession, deleteSession,
    // profile
    updateProfile, requestUpgrade,
    // misc
    health
  };
})();
