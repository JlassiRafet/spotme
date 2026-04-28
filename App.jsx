/* ============================================================
   SpotMe — Root App  (path-based routing edition)
   Top-level router. Four states:
     'booting'    : checking for a saved session on page load
     'marketing'  : public home page  (/)
     'auth'       : AuthCard (login / signup)  (/login  /register)
     'app'        : logged-in AppShell  (/dashboard  /programs  …)

   On mount we read the saved token from localStorage (via SpotMe.api)
   and call /api/auth/me to verify it.

   Path → top-level state mapping:
     /              → marketing
     /login         → auth  (login view)
     /register      → auth  (signup-1 view)
     /signup        → auth  (signup-1 view)
     /dashboard     → app   (HomeFeed)
     /activities/*  → app   (ActivitiesPage)
     /programs/*    → app   (ProgramsPage)
     /program/:id   → app   (ProgramDetailPage)
     /membership    → app   (MembershipPage)
     /profile       → app   (ProfilePage)
     /history       → app   (HistoryPage)
     unknown        → same as / (marketing) when logged out,
                      same as /dashboard when logged in
   ============================================================ */

(function () {
  const { useState, useEffect, useCallback } = React;
  const SpotMe = window.SpotMe;

  /* Apply stored theme before first render to prevent flash */
  (function bootTheme() {
    const pref = localStorage.getItem('spotme-theme') || 'system';
    const dark = pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : pref === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  })();

  /* ---------- helpers ---------- */

  /** Classify the current pathname into a top-level intent. */
  function classifyPath(pathname) {
    const p = pathname.replace(/\/$/, '') || '/';
    if (p === '/') return 'marketing';
    if (p === '/login') return 'login';
    if (p === '/register' || p === '/signup') return 'register';
    // Any app-shell path:
    const APP_PREFIXES = [
      '/dashboard', '/activities', '/programs', '/program', '/diet',
      '/membership', '/profile', '/history'
    ];
    if (APP_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/'))) return 'app';
    // Unknown path → treated as marketing root
    return 'marketing';
  }

  /** Navigate the browser to a new path without reloading. */
  function push(path) {
    history.pushState({}, '', path);
  }
  function replace(path) {
    history.replaceState({}, '', path);
  }

  /** Preserve Stripe return query when routing logged-in users away from /. */
  function stripeAppLandingQuery() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('checkout') === 'success' && p.get('sid')) return window.location.search;
      if (p.get('checkout') === 'canceled') return '?checkout=canceled';
    } catch {}
    return '';
  }

  /* ---------- App ---------- */

  function App() {
    const [route, setRoute] = useState('booting');
    const [authEntry, setAuthEntry] = useState('login');
    const [profile, setProfile] = useState(null);

    /* ---- bootstrap: check token + classify current path ---- */
    useEffect(() => {
      let cancelled = false;
      const intent = classifyPath(window.location.pathname);
      const landQ = stripeAppLandingQuery();

      (async () => {
        const savedToken = SpotMe.api.getToken();

        // Not logged in
        if (!savedToken) {
          if (cancelled) return;
          if (intent === 'login') {
            setAuthEntry('login');
            setRoute('auth');
          } else if (intent === 'register') {
            setAuthEntry('signup-1');
            setRoute('auth');
          } else if (intent === 'app') {
            // Protected path accessed while logged out → redirect to /login
            replace('/login');
            setAuthEntry('login');
            setRoute('auth');
          } else {
            replace('/');
            setRoute('marketing');
          }
          return;
        }

        // Token exists: optimistically show the right view
        const savedUser = SpotMe.api.getSavedUser();
        if (savedUser && !cancelled) {
          setProfile(savedUser);
          if (intent === 'login' || intent === 'register' || intent === 'marketing') {
            replace(landQ ? `/membership${landQ}` : '/dashboard');
            setRoute('app');
          } else {
            setRoute('app');
          }
        }

        // Verify in background
        const r = await SpotMe.api.me();
        if (cancelled) return;
        if (r.ok) {
          setProfile(r.data.user);
          if (intent === 'login' || intent === 'register' || intent === 'marketing') {
            replace(landQ ? `/membership${landQ}` : '/dashboard');
          }
          setRoute('app');
        } else {
          setProfile(null);
          if (intent === 'login') {
            setAuthEntry('login');
            setRoute('auth');
          } else if (intent === 'register') {
            setAuthEntry('signup-1');
            setRoute('auth');
          } else {
            replace('/');
            setRoute('marketing');
          }
        }
      })();

      return () => { cancelled = true; };
    }, []);

    /* ---- listen for browser back/forward ---- */
    useEffect(() => {
      const onPop = () => {
        const intent = classifyPath(window.location.pathname);
        if (intent === 'login') { setAuthEntry('login'); setRoute('auth'); }
        else if (intent === 'register') { setAuthEntry('signup-1'); setRoute('auth'); }
        else if (intent === 'marketing') setRoute('marketing');
        else if (intent === 'app') setRoute('app');
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);

    /* ---- navigation helpers ---- */

    const goAuth = useCallback((entry) => {
      setAuthEntry(entry);
      push(entry === 'signup-1' ? '/register' : '/login');
      setRoute('auth');
    }, []);

    const handleAuthComplete = useCallback((user) => {
      setProfile(user);
      push('/dashboard');
      setRoute('app');
    }, []);

    const handleLogout = useCallback(async () => {
      await SpotMe.api.logout();
      setProfile(null);
      push('/');
      setRoute('marketing');
    }, []);

    /* ---- render ---- */

    if (route === 'booting') {
      return (
        <main className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="boot-splash">
            <div className="boot-logo"><SpotMe.icons.SpotMeLogo size={48} /></div>
          </div>
        </main>
      );
    }

    if (route === 'marketing') {
      return (
        <SpotMe.HomePage
          onGoToLogin={() => goAuth('login')}
          onGoToSignup={() => goAuth('signup-1')}
        />
      );
    }

    if (route === 'auth') {
      return (
        <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <SpotMe.AuthCard
            initialView={authEntry}
            onAuthComplete={handleAuthComplete}
            onBackToMarketing={() => { push('/'); setRoute('marketing'); }}
          />
        </main>
      );
    }

    // route === 'app'
    return (
      <SpotMe.AppShell
        profile={profile}
        onUpdateProfile={setProfile}
        onLogout={handleLogout}
      />
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
