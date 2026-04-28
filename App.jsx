/* ============================================================
   SpotMe — Root App
   Top-level router. Four states:
     'booting'    : checking for a saved session on page load
     'marketing'  : public home page
     'auth'       : AuthCard (login / signup flow)
     'app'        : logged-in AppShell

   On mount we read the saved token from localStorage (via SpotMe.api)
   and call /api/auth/me to verify it. If it's valid, we skip straight
   to the app shell. If it's expired or missing, we land on marketing.
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

  function App() {
    const [route, setRoute] = useState('booting');
    const [authEntry, setAuthEntry] = useState('login');
    const [profile, setProfile] = useState(null);

    /* ---- bootstrap: check for a saved token ---- */
    useEffect(() => {
      let cancelled = false;

      (async () => {
        const savedToken = SpotMe.api.getToken();
        if (!savedToken) {
          if (!cancelled) setRoute('marketing');
          return;
        }
        // Optimistically show the saved user immediately so the UI
        // doesn't flash marketing before /me returns.
        const savedUser = SpotMe.api.getSavedUser();
        if (savedUser && !cancelled) {
          setProfile(savedUser);
          setRoute('app');
        }
        // Verify the token in the background.
        const r = await SpotMe.api.me();
        if (cancelled) return;
        if (r.ok) {
          setProfile(r.data.user);
          setRoute('app');
        } else {
          // Token was invalid/expired. api.js already cleared it.
          setProfile(null);
          setRoute('marketing');
        }
      })();

      return () => { cancelled = true; };
    }, []);

    /* ---- navigation helpers ---- */

    const goAuth = useCallback((entry) => {
      setAuthEntry(entry);
      setRoute('auth');
    }, []);

    const handleAuthComplete = useCallback((user) => {
      setProfile(user);
      setRoute('app');
    }, []);

    const handleLogout = useCallback(async () => {
      await SpotMe.api.logout();
      setProfile(null);
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
            onBackToMarketing={() => setRoute('marketing')}
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
