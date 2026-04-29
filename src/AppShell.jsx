/* ============================================================
   SpotMe — AppShell (v3, reframe)
   Responsive shell:
     - Mobile (≤719px): topbar + content + floating Dicter chip
       + bottom TabBar.
     - Desktop (≥720px): slim sidebar with the same 4 destinations
       (home / activities / programs / membership) + history & profile.

   Routing uses real URL paths via history.pushState — no hashes.
     /dashboard            → home
     /activities           → activities
     /activities/:day      → activities (specific day)
     /programs             → programs
     /programs/:category   → programs (filtered)
     /program/:id          → program detail
     /membership           → membership
     /profile              → profile
     /history              → history
   Transient screens (runner, completion) do NOT get their own URL;
   they overlay the previous path in the history stack.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useCallback, useRef } = React;
  const {
    SpotMeLogo, BellIcon, MenuIcon, CloseIcon,
    HomeIcon, CalendarIcon, DumbbellIcon, CrownIcon,
    HistoryIcon, UserIcon, LogoutIcon, LeafIcon
  } = SpotMe.icons;

  /* ---------- path <-> route ---------- */

  /** Convert a route object → a URL pathname. */
  function routeToPath(route) {
    if (!route || !route.name) return '/dashboard';
    const { name, programId, category, day } = route;
    switch (name) {
      case 'home':        return '/dashboard';
      case 'activities':  return day ? `/activities/${encodeURIComponent(day)}` : '/activities';
      case 'programs':    return (category && category !== 'all') ? `/programs/${encodeURIComponent(category)}` : '/programs';
      case 'program':     return programId ? `/program/${encodeURIComponent(programId)}` : '/programs';
      case 'diet':        return '/diet';
      case 'membership':  return '/membership';
      case 'book-coach':  return '/book-coach';
      case 'profile':     return '/profile';
      case 'history':     return '/history';
      case 'help-center': return '/help-center';
      case 'terms':       return '/terms';
      case 'privacy':     return '/privacy';
      // Transient — stay at current URL
      default:            return window.location.pathname;
    }
  }

  /** Convert the current pathname → an in-app route object. */
  function pathToRoute(pathname) {
    const p = pathname.replace(/\/$/, '') || '/dashboard';
    const segments = p.replace(/^\//, '').split('/');
    const [seg0, seg1] = segments;
    switch (seg0) {
      case 'dashboard':  return { name: 'home' };
      case 'activities': return seg1 ? { name: 'activities', day: decodeURIComponent(seg1) } : { name: 'activities' };
      case 'programs':   return seg1 ? { name: 'programs', category: decodeURIComponent(seg1) } : { name: 'programs' };
      case 'program':    return seg1 ? { name: 'program', programId: decodeURIComponent(seg1) } : { name: 'programs' };
      case 'diet':       return { name: 'diet' };
      case 'membership': return { name: 'membership' };
      case 'book-coach': return { name: 'book-coach' };
      case 'profile':    return { name: 'profile' };
      case 'history':    return { name: 'history' };
      case 'help-center':return { name: 'help-center' };
      case 'terms':      return { name: 'terms' };
      case 'privacy':    return { name: 'privacy' };
      default:           return { name: 'home' };
    }
  }

  /* ---------- Avatar (re-export) ---------- */
  function Avatar({ profile, size = 36 }) {
    const initial = (profile?.firstName || '?').charAt(0).toUpperCase();
    return (
      <span
        className="fit-avatar-btn"
        style={{
          width: size, height: size, fontSize: size * 0.36,
          cursor: 'default', pointerEvents: 'none'
        }}
      >
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initial}
      </span>
    );
  }

  /* ---------- Profile menu (popover) ---------- */
  function ProfileMenu({ profile, onNavigate, onLogout, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
      const outside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      const esc = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', esc);
      return () => {
        document.removeEventListener('mousedown', outside);
        document.removeEventListener('keydown', esc);
      };
    }, [onClose]);

    return (
      <div className="profile-menu" ref={ref} role="menu">
        <div className="profile-menu-header">
          <Avatar profile={profile} size={36} />
          <div className="profile-menu-info">
            <div className="profile-menu-name">
              {(profile.firstName || '') + ' ' + (profile.lastName || '')}
            </div>
            <div className="profile-menu-email">{profile.email}</div>
          </div>
        </div>
        <div className="profile-menu-divider" />
        <button type="button" role="menuitem" className="profile-menu-item"
                onClick={() => { onNavigate('profile'); onClose(); }}>
          <span style={{ width: 16, height: 16, display: 'inline-flex' }}><UserIcon /></span>
          <span>Account</span>
        </button>
        <button type="button" role="menuitem" className="profile-menu-item"
                onClick={() => { onNavigate('history'); onClose(); }}>
          <span style={{ width: 16, height: 16, display: 'inline-flex' }}><HistoryIcon /></span>
          <span>History</span>
        </button>
        {profile.plan !== 'pro' && (
          <button type="button" role="menuitem" className="profile-menu-item"
                  onClick={() => { onNavigate('membership'); onClose(); }}>
            <span style={{ width: 16, height: 16, display: 'inline-flex' }}><CrownIcon /></span>
            <span>Upgrade plan</span>
          </button>
        )}
        <div className="profile-menu-divider" />
        <button type="button" role="menuitem" className="profile-menu-item profile-menu-signout"
                onClick={() => { onLogout(); onClose(); }}>
          <span style={{ width: 16, height: 16, display: 'inline-flex' }}><LogoutIcon /></span>
          <span>Sign out</span>
        </button>
      </div>
    );
  }

  /* ---------- Mobile drawer ---------- */
  function MobileDrawer({ profile, activeName, onNavigate, onLogout, onClose }) {
    useEffect(() => {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }, []);

    const NAV = [
      { name: 'home',       label: 'Home',        Icon: HomeIcon },
      { name: 'activities', label: 'Activities',  Icon: CalendarIcon },
      { name: 'programs',   label: 'Programs',    Icon: DumbbellIcon },
      { name: 'diet',       label: 'Nutrition',   Icon: LeafIcon },
      { name: 'membership', label: 'Membership',  Icon: CrownIcon },
      { name: 'history',    label: 'History',     Icon: HistoryIcon },
      { name: 'profile',    label: 'Account',     Icon: UserIcon }
    ];

    return (
      <>
        <div className="fit-drawer-overlay" onClick={onClose} aria-hidden="true" />
        <aside className="fit-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="fit-drawer-header">
            <SpotMeLogo size={28} />
            <button type="button" className="fit-icon-btn" onClick={onClose} aria-label="Close menu">
              <span style={{ width: 16, height: 16, display: 'inline-flex' }}><CloseIcon /></span>
            </button>
          </div>

          {NAV.map(({ name, label, Icon }) => (
            <button
              key={name}
              type="button"
              className={`fit-drawer-item${activeName === name ? ' is-active' : ''}`}
              onClick={() => { onNavigate(name); onClose(); }}
            >
              <span style={{ width: 18, height: 18, display: 'inline-flex' }}><Icon /></span>
              <span>{label}</span>
            </button>
          ))}

          <div style={{ flex: 1 }} />
          <div className="fit-drawer-divider" />

          <button
            type="button"
            className="fit-drawer-item"
            style={{ color: 'var(--acc-coral)' }}
            onClick={() => { onLogout(); onClose(); }}
          >
            <span style={{ width: 18, height: 18, display: 'inline-flex' }}><LogoutIcon /></span>
            <span>Sign out</span>
          </button>
        </aside>
      </>
    );
  }

  /* ---------- Sidebar (desktop) ---------- */
  function Sidebar({ profile, activeName, onNavigate, onOpenProfile }) {
    const isPro = profile?.plan === 'pro';
    const NAV = [
      { name: 'home',       label: 'Home',       Icon: HomeIcon },
      { name: 'activities', label: 'Activities', Icon: CalendarIcon },
      { name: 'programs',   label: 'Programs',   Icon: DumbbellIcon },
      { name: 'diet',       label: 'Nutrition',  Icon: LeafIcon },
      { name: 'membership', label: 'Membership', Icon: CrownIcon },
      ...(isPro ? [{ name: 'book-coach', label: 'Book a Coach', Icon: CalendarIcon, pro: true }] : []),
    ];
    return (
      <aside className="fit-sidebar">
        <div className="fit-sidebar-logo">
          <button type="button" onClick={() => onNavigate('home')} aria-label="Home">
            <SpotMeLogo size={28} />
          </button>
        </div>
        <nav className="fit-sidebar-nav" aria-label="Primary">
          {NAV.map(({ name, label, Icon }) => (
            <button
              key={name}
              type="button"
              className={`fit-sidebar-btn${activeName === name ? ' is-active' : ''}`}
              onClick={() => onNavigate(name)}
              aria-label={label}
              title={label}
            >
              <span style={{ width: 22, height: 22, display: 'inline-flex' }}><Icon /></span>
            </button>
          ))}
          <button
            type="button"
            className={`fit-sidebar-btn${activeName === 'history' ? ' is-active' : ''}`}
            onClick={() => onNavigate('history')}
            aria-label="History"
            title="History"
          >
            <span style={{ width: 22, height: 22, display: 'inline-flex' }}><HistoryIcon /></span>
          </button>
        </nav>
        <div className="fit-sidebar-bottom">
          <button
            type="button"
            className="fit-sidebar-avatar"
            onClick={onOpenProfile}
            aria-label="Profile menu"
          >
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt="" />
              : (profile?.firstName || '?').charAt(0).toUpperCase()}
          </button>
        </div>
      </aside>
    );
  }

  /* ── Pro success modal ─────────────────────────────────────── */
  function ProSuccessModal({ onClose }) {
    useEffect(() => {
      const id = setTimeout(onClose, 4500);
      return () => clearTimeout(id);
    }, [onClose]);
    return (
      <div className="pro-success-overlay" onClick={onClose}>
        <div className="pro-success-modal" onClick={e => e.stopPropagation()}>
          <div className="pro-success-icon">🎉</div>
          <h2 className="pro-success-title">You're now a PRO member!</h2>
          <p className="pro-success-sub">Enjoy unlimited AI coaching and all premium features.</p>
          <div className="pro-success-badge"><span>PRO</span></div>
          <button type="button" className="pro-success-close" onClick={onClose}>Got it →</button>
          <div className="pro-success-timer" />
        </div>
      </div>
    );
  }

  /* ============================================================
     AppShell
     ============================================================ */
  function AppShell({ profile, onUpdateProfile, onLogout }) {
    const [route, setRoute] = useState(() => pathToRoute(window.location.pathname));
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [dicterOpen, setDicterOpen] = useState(false);
    const [bellPulse, setBellPulse] = useState(true);
    const [showProSuccess, setShowProSuccess] = useState(false);

    /* navigate / back ----------------------------------------- */
    const navigate = useCallback((name, params = {}) => {
      setRoute(prev => ({ name, ...params, _prev: prev }));
    }, []);

    const back = useCallback(() => {
      setRoute(prev => {
        if (prev?.from)  return prev.from;
        if (prev?._prev) return prev._prev;
        return { name: 'home' };
      });
    }, []);

    /* URL path sync ------------------------------------------- */
    useEffect(() => {
      // Transient screens (runner, dietRunner, completion) don't get their own URL.
      if (route.name === 'runner' || route.name === 'dietRunner' || route.name === 'completion') return;
      const target = routeToPath(route);
      if (window.location.pathname !== target) {
        history.pushState({}, '', target);
      }
    }, [route]);

    useEffect(() => {
      // Handle browser back/forward buttons inside the shell.
      const onPop = () => {
        const next = pathToRoute(window.location.pathname);
        setRoute(prev => (prev.name === next.name ? prev : next));
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);

    /* Stripe Checkout success — verify session, update profile, redirect to book-coach */
    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') !== 'success') return undefined;

      const sessionId = params.get('sid') || '';
      let cancelled = false;

      // Clean URL immediately
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        url.searchParams.delete('sid');
        url.searchParams.delete('page');
        history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''));
      } catch (_) {}

      // Show success modal right away
      setShowProSuccess(true);

      (async () => {
        // Verify the checkout session directly — upgrades DB without waiting for webhook
        if (sessionId) {
          const r = await SpotMe.api.request('/api/subscription/verify', {
            method: 'POST', body: { sessionId },
          });
          if (cancelled) return;
          if (r.ok && r.data?.user) {
            onUpdateProfile(r.data.user);
          }
        } else {
          // Fallback: poll /api/auth/me
          let attempts = 0;
          const iv = setInterval(async () => {
            if (cancelled) { clearInterval(iv); return; }
            attempts++;
            const r = await SpotMe.api.me();
            if (r.ok && r.data?.user) {
              onUpdateProfile(r.data.user);
              if (r.data.user.plan === 'pro' || attempts >= 10) clearInterval(iv);
            } else { clearInterval(iv); }
          }, 2000);
        }

        // Navigate to Book a Coach page
        if (!cancelled) navigate('book-coach');
      })();

      return () => { cancelled = true; };
    }, [onUpdateProfile]);

    /* keyboard: ctrl/cmd opens Dicter -------------------------- */
    useEffect(() => {
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === '/' && !dicterOpen) {
          e.preventDefault();
          setDicterOpen(true);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [dicterOpen]);

    /* derive top bar visibility ------------------------------- */
    const HIDE_TOPBAR = ['runner', 'dietRunner', 'completion', 'activities', 'programs', 'program', 'diet', 'membership', 'home', 'help-center', 'terms', 'privacy'];
    const showTopbar = !HIDE_TOPBAR.includes(route.name);
    const isFullScreenMode = route.name === 'runner' || route.name === 'dietRunner';

    /* render -------------------------------------------------- */
    return (
      <>
      {showProSuccess && <ProSuccessModal onClose={() => setShowProSuccess(false)} />}
      <div className="fit-shell">
        <div className="fit-shell-bg-blob-1" aria-hidden="true" />
        <div className="fit-shell-bg-blob-2" aria-hidden="true" />

        <Sidebar
          profile={profile}
          activeName={route.name}
          onNavigate={(n) => navigate(n)}
          onOpenProfile={() => setProfileMenuOpen(o => !o)}
        />

        <main className="fit-main">
          {showTopbar && (
            <header className="fit-topbar">
              <button
                type="button"
                className="fit-icon-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                style={{ display: 'inline-flex' }}
              >
                <span style={{ width: 18, height: 18, display: 'inline-flex' }}><MenuIcon /></span>
              </button>
              <h1 className="fit-topbar-title">SpotMe</h1>
              <div className="fit-topbar-actions">
              </div>
            </header>
          )}

          {/* Route switch ------------------------------------- */}
          {route.name === 'home' && SpotMe.HomeFeed && (
            <SpotMe.HomeFeed
              profile={profile}
              onNavigate={navigate}
              onOpenProfile={() => setProfileMenuOpen(o => !o)}
              onOpenBell={() => setBellPulse(false)}
              onOpenChat={() => setDicterOpen(true)}
            />
          )}

          {route.name === 'activities' && SpotMe.TrackerPage && (
            <SpotMe.TrackerPage profile={profile} />
          )}

          {route.name === 'programs' && SpotMe.ProgramsPage && (
            <SpotMe.ProgramsPage
              profile={profile}
              route={route}
              onNavigate={navigate}
              onBack={back}
            />
          )}

          {route.name === 'diet' && SpotMe.DietPage && (
            <SpotMe.DietPage
              profile={profile}
              route={route}
              onNavigate={navigate}
              onBack={back}
            />
          )}

          {route.name === 'program' && SpotMe.ProgramDetailPage && (
            <SpotMe.ProgramDetailPage
              profile={profile}
              route={route}
              onNavigate={navigate}
              onBack={back}
            />
          )}

          {route.name === 'runner' && SpotMe.SessionRunner && (
            <SpotMe.SessionRunner
              profile={profile}
              route={route}
              onNavigate={navigate}
              onBack={back}
            />
          )}

          {route.name === 'dietRunner' && SpotMe.DietRunner && (
            <SpotMe.DietRunner
              profile={profile}
              route={route}
              onNavigate={navigate}
              onBack={back}
            />
          )}

          {route.name === 'completion' && SpotMe.CompletionPage && (
            <SpotMe.CompletionPage
              profile={profile}
              route={route}
              onNavigate={navigate}
            />
          )}

          {route.name === 'membership' && SpotMe.MembershipPage && (
            <SpotMe.MembershipPage
              profile={profile}
              onBack={back}
            />
          )}

          {route.name === 'book-coach' && SpotMe.BookCoachPage && (
            <SpotMe.BookCoachPage
              profile={profile}
              onNavigate={navigate}
            />
          )}

          {route.name === 'help-center' && SpotMe.HelpCenterPage && (
            <SpotMe.HelpCenterPage onBack={back} />
          )}

          {route.name === 'terms' && SpotMe.TermsPage && (
            <SpotMe.TermsPage onBack={back} />
          )}

          {route.name === 'privacy' && SpotMe.PrivacyPage && (
            <SpotMe.PrivacyPage onBack={back} />
          )}

          {route.name === 'profile' && SpotMe.ProfilePage && (
            <div className="fit-page" style={{ paddingTop: 12 }}>
              <SpotMe.ProfilePage
                profile={profile}
                onNavigate={navigate}
                onUpdateProfile={onUpdateProfile}
                onLogout={onLogout}
                onDeleteAccount={async () => {
                  const r = await SpotMe.api.deleteAccount();
                  if (r.ok) onLogout();
                  return r;
                }}
              />
            </div>
          )}

          {route.name === 'history' && SpotMe.HistoryPage && (
            <div className="fit-page" style={{ paddingTop: 12 }}>
              <SpotMe.HistoryPage
                onOpenChat={(session) => {
                  setDicterOpen(session || true);
                  navigate('home');
                }}
              />
            </div>
          )}
        </main>

        {/* Tab bar (mobile only) ------------------------------ */}
        {!isFullScreenMode && SpotMe.TabBar && (
          <SpotMe.TabBar
            activeName={route.name}
            onNavigate={(n) => navigate(n)}
          />
        )}

        {/* Floating Dicter chip ------------------------------- */}
        {SpotMe.DicterChip && (
          <SpotMe.DicterChip
            hidden={isFullScreenMode || dicterOpen}
            onOpen={() => setDicterOpen(true)}
          />
        )}

        {/* Dicter overlay ------------------------------------- */}
        {dicterOpen && SpotMe.DicterOverlay && (
          <SpotMe.DicterOverlay
            profile={profile}
            initialSession={typeof dicterOpen === 'object' ? dicterOpen : null}
            onClose={() => setDicterOpen(false)}
          />
        )}

        {/* Profile menu popover ------------------------------- */}
        {profileMenuOpen && (
          <div style={{
            position: 'fixed',
            bottom: 100, left: 16,
            zIndex: 60
          }}>
            <ProfileMenu
              profile={profile}
              onNavigate={(p) => navigate(p)}
              onLogout={onLogout}
              onClose={() => setProfileMenuOpen(false)}
            />
          </div>
        )}

        {/* Mobile drawer -------------------------------------- */}
        {drawerOpen && (
          <MobileDrawer
            profile={profile}
            activeName={route.name}
            onNavigate={(n) => navigate(n)}
            onLogout={onLogout}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </div>
      </>
    );
  }

  SpotMe.AppShell = AppShell;
  SpotMe.Avatar = Avatar;
})();
