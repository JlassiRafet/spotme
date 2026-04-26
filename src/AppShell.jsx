/* ============================================================
   SpotMe — AppShell
   Full-screen logged-in shell. Left sidebar + top bar + main.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useCallback, useRef } = React;
  const {
    SpotMeLogo, PlusIcon, HistoryIcon, TrackerIcon, BellIcon,
    LogoutIcon, CrownIcon
  } = SpotMe.icons;

  function PlansIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    );
  }

  function AboutIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    );
  }

  function Avatar({ profile, size = 32, showPro = true }) {
    const initial = (profile.firstName || '?').charAt(0).toUpperCase();
    return (
      <span className="avatar-chip" style={{ width: size, height: size }}>
        {profile.avatar ? (
          <img src={profile.avatar} alt="" />
        ) : (
          <span className="avatar-initial">{initial}</span>
        )}
        {showPro && profile.subscription === 'pro' && (
          <span className="avatar-pro" aria-label="Pro member">Pro</span>
        )}
      </span>
    );
  }

  function SidebarItem({ icon, label, active, onClick }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`sidebar-item${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className="sidebar-icon">{icon}</span>
        <span className="sidebar-label">{label}</span>
      </button>
    );
  }

  function NotificationBell({ enabled, onToggle, hasUnread }) {
    return (
      <button type="button" onClick={onToggle}
              aria-label={enabled ? 'Disable notifications' : 'Enable notifications'}
              aria-pressed={enabled}
              className={`bell-btn${enabled ? ' is-on' : ' is-off'}${hasUnread ? ' has-unread' : ''}`}>
        <BellIcon active={enabled} />
        {enabled && hasUnread && <span className="bell-dot" />}
      </button>
    );
  }

  /* Perplexity-style profile popup menu */
  function ProfileMenu({ profile, onNavigate, onLogout, onClose }) {
    const menuRef = useRef(null);

    useEffect(() => {
      function outside(e) {
        if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
      }
      function esc(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', esc);
      return () => {
        document.removeEventListener('mousedown', outside);
        document.removeEventListener('keydown', esc);
      };
    }, [onClose]);

    const displayName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    return (
      <div className="profile-menu" ref={menuRef} role="menu">
        <div className="profile-menu-header">
          <Avatar profile={profile} size={36} showPro={false} />
          <div className="profile-menu-info">
            <div className="profile-menu-name">{displayName}</div>
            <div className="profile-menu-email">{profile.email}</div>
          </div>
        </div>
        <div className="profile-menu-divider" />
        <button type="button" role="menuitem" className="profile-menu-item"
                onClick={() => { onNavigate('profile'); onClose(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Account</span>
        </button>
        {profile.subscription !== 'pro' && (
          <button type="button" role="menuitem" className="profile-menu-item"
                  onClick={() => { onNavigate('tracker'); onClose(); }}>
            <CrownIcon />
            <span>Upgrade plan</span>
          </button>
        )}
        <button type="button" role="menuitem" className="profile-menu-item is-disabled" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>Language</span>
          <span className="profile-menu-badge">Soon</span>
        </button>
        <button type="button" role="menuitem" className="profile-menu-item is-disabled" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Help</span>
          <span className="profile-menu-badge">Soon</span>
        </button>
        <div className="profile-menu-divider" />
        <button type="button" role="menuitem" className="profile-menu-item profile-menu-signout"
                onClick={() => { onLogout(); onClose(); }}>
          <LogoutIcon />
          <span>Sign out</span>
        </button>
      </div>
    );
  }

  /* Mobile slide-in drawer */
  function MobileDrawer({ profile, page, onNavigate, onLogout, onNewChat, onClose,
                           sessions, historyExpanded, setHistoryExpanded, loadSessions }) {
    const drawerRef = useRef(null);
    const displayName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }, []);

    function nav(p) { onNavigate(p); onClose(); }

    return (
      <>
        <div className="mobile-overlay" onClick={onClose} aria-hidden="true" />
        <div className="mobile-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu">
          {/* Header */}
          <div className="mobile-drawer-header">
            <SpotMeLogo size={26} />
            <button type="button" className="mobile-drawer-close" onClick={onClose} aria-label="Close menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Profile chip */}
          <div className="mobile-drawer-profile">
            <Avatar profile={profile} size={40} />
            <div style={{ minWidth: 0 }}>
              <div className="profile-chip-name">{displayName}</div>
              <div style={{ fontSize: '0.75rem', color: '#5c7aa8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>
            </div>
          </div>

          <div className="mobile-drawer-divider" />

          {/* Nav */}
          <nav className="mobile-drawer-nav">
            <button type="button" className="mobile-drawer-item" onClick={() => { onNewChat(); onClose(); }}>
              <PlusIcon />
              <span>New chat</span>
            </button>
            <button type="button"
                    className={`mobile-drawer-item${page === 'history' ? ' is-active' : ''}`}
                    onClick={() => { loadSessions(); nav('history'); }}>
              <HistoryIcon />
              <span>History</span>
            </button>
            <button type="button"
                    className={`mobile-drawer-item${page === 'tracker' ? ' is-active' : ''}`}
                    onClick={() => nav('tracker')}>
              <TrackerIcon />
              <span>Tracker</span>
            </button>
            <button type="button"
                    className={`mobile-drawer-item${page === 'plans' ? ' is-active' : ''}`}
                    onClick={() => nav('plans')}>
              <PlansIcon />
              <span>Plans</span>
            </button>
            <button type="button"
                    className={`mobile-drawer-item${page === 'about' ? ' is-active' : ''}`}
                    onClick={() => nav('about')}>
              <AboutIcon />
              <span>About</span>
            </button>
          </nav>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <>
              <div className="mobile-drawer-divider" />
              <div className="mobile-drawer-section-label">Recent</div>
              <div className="mobile-drawer-sessions">
                {sessions.slice(0, 8).map(s => (
                  <button key={s.id} type="button" className="mobile-drawer-session"
                          onClick={() => { onNavigate('restore', s); onClose(); }}>
                    <span className="sidebar-session-title">{s.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ flex: 1 }} />
          <div className="mobile-drawer-divider" />

          {/* Bottom actions */}
          <div className="mobile-drawer-nav">
            <button type="button"
                    className={`mobile-drawer-item${page === 'profile' ? ' is-active' : ''}`}
                    onClick={() => nav('profile')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>Account</span>
            </button>
            <button type="button" className="mobile-drawer-item mobile-drawer-signout"
                    onClick={() => { onLogout(); onClose(); }}>
              <LogoutIcon />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  function AppShell({ profile, onUpdateProfile, onLogout }) {
    const [page, setPage] = useState('chat');
    const [chatSessionId, setChatSessionId] = useState(0);
    const [bellEnabled, setBellEnabled] = useState(true);
    const [hasUnread, setHasUnread] = useState(true);
    const [restoredSession, setRestoredSession] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarSessions, setSidebarSessions] = useState([]);
    const [historyExpanded, setHistoryExpanded] = useState(true);

    const loadSidebarSessions = useCallback(() => {
      SpotMe.api.listSessions().then(r => {
        if (r.ok) setSidebarSessions(r.data.sessions || []);
      });
    }, []);

    useEffect(() => { loadSidebarSessions(); }, []);

    const startNewChat = useCallback(() => {
      setRestoredSession(null);
      setChatSessionId(id => id + 1);
      setPage('chat');
    }, []);

    const toggleBell = useCallback(() => {
      setBellEnabled(v => {
        const next = !v;
        if (next) setHasUnread(false);
        return next;
      });
    }, []);

    const pageTitle =
      page === 'chat'    ? 'New conversation' :
      page === 'profile' ? 'Account' :
      page === 'tracker' ? 'Tracker' :
      page === 'history' ? 'History' :
      page === 'plans'   ? 'Plans' :
      page === 'about'   ? 'About' :
                           'SpotMe';

    return (
      <div className="app-shell">
        {/* Mobile slide-in drawer */}
        {mobileMenuOpen && (
          <MobileDrawer
            profile={profile}
            page={page}
            onNavigate={(p, session) => {
              if (p === 'restore' && session) {
                setRestoredSession(session);
                setChatSessionId(id => id + 1);
                setPage('chat');
              } else {
                setPage(p);
              }
            }}
            onLogout={onLogout}
            onNewChat={startNewChat}
            onClose={() => setMobileMenuOpen(false)}
            sessions={sidebarSessions}
            historyExpanded={historyExpanded}
            setHistoryExpanded={setHistoryExpanded}
            loadSessions={loadSidebarSessions}
          />
        )}

        <aside className="app-sidebar">
          <div className="app-sidebar-top">
            <button type="button" className="sidebar-logo-btn"
                    onClick={() => { setPage('chat'); setChatSessionId(id => id + 1); }}
                    aria-label="SpotMe home">
              <SpotMeLogo size={28} />
            </button>
          </div>

          <nav className="app-sidebar-nav">
            <SidebarItem icon={<PlusIcon />} label="New chat"
                         active={false} onClick={startNewChat} />

            <SidebarItem icon={<TrackerIcon />} label="Tracker"
                         active={page === 'tracker'}
                         onClick={() => setPage('tracker')} />

            <SidebarItem icon={<PlansIcon />} label="Plans"
                         active={page === 'plans'}
                         onClick={() => setPage('plans')} />

            <SidebarItem icon={<AboutIcon />} label="About"
                         active={page === 'about'}
                         onClick={() => setPage('about')} />

            <div className="sidebar-history-group">
              <div className="sidebar-history-header">
                <button type="button"
                        className={`sidebar-history-btn${page === 'history' ? ' is-active' : ''}`}
                        onClick={() => { loadSidebarSessions(); setPage('history'); }}>
                  <span className="sidebar-icon"><HistoryIcon /></span>
                  <span className="sidebar-label">History</span>
                </button>
                {sidebarSessions.length > 0 && (
                  <button type="button"
                          className={`sidebar-chevron-btn${historyExpanded ? ' is-expanded' : ''}`}
                          onClick={() => setHistoryExpanded(v => !v)}
                          aria-label={historyExpanded ? 'Collapse history' : 'Expand history'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                         strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                )}
              </div>
              {historyExpanded && sidebarSessions.length > 0 && (
                <div className="sidebar-sessions">
                  {sidebarSessions.slice(0, 12).map(s => (
                    <button key={s.id} type="button" className="sidebar-session-item"
                            onClick={() => {
                              setRestoredSession(s);
                              setChatSessionId(id => id + 1);
                              setPage('chat');
                            }}>
                      <span className="sidebar-session-title">{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="app-sidebar-profile">
            <div className="profile-chip-wrap">
              {menuOpen && (
                <ProfileMenu
                  profile={profile}
                  onNavigate={(p) => setPage(p)}
                  onLogout={onLogout}
                  onClose={() => setMenuOpen(false)}
                />
              )}
              <button type="button" className="profile-chip"
                      onClick={() => setMenuOpen(o => !o)}
                      aria-label="Profile menu"
                      aria-haspopup="true"
                      aria-expanded={menuOpen}>
                <Avatar profile={profile} size={36} />
                <span className="profile-chip-name">
                  {profile.firstName} {profile.lastName}
                </span>
              </button>
            </div>
            <NotificationBell enabled={bellEnabled}
                              onToggle={toggleBell}
                              hasUnread={hasUnread} />
          </div>
        </aside>

        <div className="app-main">
          <header className="app-topbar">
            {/* Hamburger — mobile only */}
            <button type="button"
                    className="hamburger-btn"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label="Open menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="app-topbar-title">{pageTitle}</h1>
            <div className="app-topbar-actions" />
          </header>

          <section className="app-body">
            {page === 'chat' && SpotMe.ChatPage && (
              <SpotMe.ChatPage key={chatSessionId}
                               profile={profile}
                               initialSession={restoredSession}
                               onSessionCreated={loadSidebarSessions} />
            )}
            {page === 'profile' && SpotMe.ProfilePage && (
              <SpotMe.ProfilePage profile={profile}
                                  onUpdateProfile={onUpdateProfile}
                                  onLogout={onLogout}
                                  onDeleteAccount={async () => {
                                    const r = await SpotMe.api.deleteAccount();
                                    if (r.ok) onLogout();
                                    return r;
                                  }} />
            )}
            {page === 'tracker' && SpotMe.UnderDev && (
              <SpotMe.UnderDev title="Tracker — Pro feature"
                               body="Progress tracking is part of SpotMe Pro. Upgrade to unlock weekly trends, PR charts, and goal streaks." />
            )}
            {page === 'plans' && SpotMe.PlansPage && (
              <SpotMe.PlansPage onBack={() => setPage('chat')} />
            )}
            {page === 'about' && SpotMe.AboutPage && (
              <SpotMe.AboutPage />
            )}
            {page === 'history' && SpotMe.HistoryPage && (
              <SpotMe.HistoryPage
                onOpenChat={(session) => {
                  setRestoredSession(session || null);
                  setChatSessionId(id => id + 1);
                  loadSidebarSessions();
                  setPage('chat');
                }}
              />
            )}
          </section>
        </div>
      </div>
    );
  }

  SpotMe.AppShell = AppShell;
  SpotMe.Avatar = Avatar;
})();
