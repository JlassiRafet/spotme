/* ============================================================
   SpotMe — AppShell
   Full-screen logged-in shell. Left sidebar + top bar + main.
   Owns: current page, notification bell state, user profile.
   Renders the active page from SpotMe.pages.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useCallback } = React;
  const {
    SpotMeLogo, PlusIcon, HistoryIcon, TrackerIcon, BellIcon,
    HomeIcon, LogoutIcon
  } = SpotMe.icons;

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

  function SidebarItem({ icon, label, active, onClick, collapsed }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`sidebar-item${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className="sidebar-icon">{icon}</span>
        {!collapsed && <span className="sidebar-label">{label}</span>}
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

  function UpgradeCta({ onClick }) {
    return (
      <button type="button" className="upgrade-cta liquid" onClick={onClick}>
        <span className="upgrade-icon">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 18h20v2H2zM3 6l4 4 5-6 5 6 4-4v10H3z"/></svg>
        </span>
        <span className="upgrade-body">
          <strong>UPGRADE TO PRO</strong>
          <span>Unlock progress tracking</span>
        </span>
        <span className="upgrade-arrow">›</span>
      </button>
    );
  }

  /* The shell owns page state. The logged-in pages it can render:
     - 'chat'     : the live chat (new session each time 'new-chat' is fired)
     - 'profile'  : user profile page
     - 'tracker'  : under-development teaser (locked behind subscription)
     - 'history'  : chat history list
  */
  function AppShell({ profile, onUpdateProfile, onLogout }) {
    const [page, setPage] = useState('chat');
    // Each time the user clicks "New Chat" we bump this so the ChatPage
    // remounts (via key={chatSessionId}) and starts fresh.
    const [chatSessionId, setChatSessionId] = useState(0);
    const [bellEnabled, setBellEnabled] = useState(true);
    const [hasUnread, setHasUnread] = useState(true);
    const [history, setHistory] = useState([]); // past chat sessions

    const startNewChat = useCallback(() => {
      setChatSessionId(id => id + 1);
      setPage('chat');
    }, []);

    const appendHistory = useCallback((entry) => {
      setHistory(h => [entry, ...h].slice(0, 50));
    }, []);

    const toggleBell = useCallback(() => {
      setBellEnabled(v => {
        const next = !v;
        if (next) setHasUnread(false); // opening = read
        return next;
      });
    }, []);

    // Page title in the top bar varies by page
    const pageTitle =
      page === 'chat'    ? 'New conversation' :
      page === 'profile' ? 'Account' :
      page === 'tracker' ? 'Tracker' :
      page === 'history' ? 'History' :
                           'SpotMe';

    return (
      <div className="app-shell">
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
            <SidebarItem icon={<HomeIcon />} label="Chat"
                         active={page === 'chat'}
                         onClick={() => setPage('chat')} />
            <SidebarItem icon={<HistoryIcon />} label="History"
                         active={page === 'history'}
                         onClick={() => setPage('history')} />
            <SidebarItem icon={<TrackerIcon />} label="Tracker"
                         active={page === 'tracker'}
                         onClick={() => setPage('tracker')} />
          </nav>

          {profile.subscription !== 'pro' && (
            <div className="app-sidebar-upgrade">
              <UpgradeCta onClick={() => setPage('tracker')} />
            </div>
          )}

          <div className="app-sidebar-profile">
            <button type="button" className="profile-chip"
                    onClick={() => setPage('profile')}
                    aria-label="Go to profile">
              <Avatar profile={profile} size={36} />
              <span className="profile-chip-name">
                {profile.firstName} {profile.lastName}
              </span>
            </button>
            <NotificationBell enabled={bellEnabled}
                              onToggle={toggleBell}
                              hasUnread={hasUnread} />
          </div>
        </aside>

        <div className="app-main">
          <header className="app-topbar">
            <h1 className="app-topbar-title">{pageTitle}</h1>
            <div className="app-topbar-actions">
              <button type="button" className="btn-text"
                      onClick={onLogout}
                      aria-label="Log out"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LogoutIcon /> <span>Log out</span>
              </button>
            </div>
          </header>

          <section className="app-body">
            {page === 'chat' && SpotMe.ChatPage && (
              <SpotMe.ChatPage key={chatSessionId}
                               profile={profile}
                               onSessionEnd={appendHistory} />
            )}
            {page === 'profile' && SpotMe.ProfilePage && (
              <SpotMe.ProfilePage profile={profile}
                                  onUpdateProfile={onUpdateProfile} />
            )}
            {page === 'tracker' && SpotMe.UnderDev && (
              <SpotMe.UnderDev title="Tracker — Pro feature"
                               body="Progress tracking is part of SpotMe Pro. Upgrade to unlock weekly trends, PR charts, and goal streaks." />
            )}
            {page === 'history' && SpotMe.HistoryPage && (
              <SpotMe.HistoryPage history={history}
                                  onOpenChat={() => setPage('chat')} />
            )}
          </section>
        </div>
      </div>
    );
  }

  SpotMe.AppShell = AppShell;
  SpotMe.Avatar = Avatar;
})();
