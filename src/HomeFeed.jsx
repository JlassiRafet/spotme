/* ============================================================
   SpotMe — HomeFeed
   Logged-in home: greeting + 3 action cards (Programs, Diet, Chat).
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { BellIcon, DumbbellIcon, LeafIcon, SparkleIcon } = SpotMe.icons;

  function Avatar({ profile, size = 44, onClick }) {
    const initial = (profile?.firstName || '?').charAt(0).toUpperCase();
    const Tag = onClick ? 'button' : 'span';
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className="fit-avatar-btn"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-label={onClick ? 'Open profile menu' : undefined}
      >
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initial}
      </Tag>
    );
  }

  function HomeFeed({ profile, onNavigate, onOpenProfile, onOpenBell, onOpenChat }) {
    const firstName = profile?.firstName || 'there';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const ACTIONS = [
      {
        key: 'programs',
        label: 'Training Programs',
        sub: 'Muscle, cardio and more — guided sessions with form cues and muscle maps.',
        img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=60',
        accent: 'var(--acc-mint)',
        Icon: DumbbellIcon,
        cta: 'Browse programs',
        onClick: () => onNavigate('programs'),
      },
      {
        key: 'diet',
        label: 'Nutrition Plans',
        sub: 'Keto, Mediterranean, Vegetarian and Macro — 7-day guides with real food tips.',
        img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=60',
        accent: 'var(--acc-lime)',
        Icon: LeafIcon,
        cta: 'Explore diets',
        onClick: () => onNavigate('diet'),
      },
      {
        key: 'chat',
        label: 'AI Coach',
        sub: 'Ask anything — form checks, program advice, recovery tips. Always available.',
        img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=60',
        accent: '#a78bfa',
        Icon: SparkleIcon,
        cta: 'Start chatting',
        onClick: () => onOpenChat?.(),
      },
    ];

    return (
      <div className="fit-home">
        <div className="fit-page">

          {/* Header */}
          <header className="fit-hero" style={{ marginBottom: 8 }}>
            <div>
              <div className="home-greeting">{greeting},</div>
              <h1 className="h-display" style={{ margin: 0 }}>
                <em>{firstName}.</em>
              </h1>
            </div>
            <div className="fit-hero-actions">
              <Avatar profile={profile} size={44} onClick={onOpenProfile} />
              <button
                type="button"
                className="fit-icon-btn"
                onClick={onOpenBell}
                aria-label="Notifications"
                style={{ position: 'relative' }}
              >
                <span style={{ width: 18, height: 18, display: 'inline-flex' }}><BellIcon active /></span>
                <span className="dot" />
              </button>
            </div>
          </header>

          <p className="home-sub">What do you want to do today?</p>

          {/* Action cards */}
          <div className="home-actions">
            {ACTIONS.map(({ key, label, sub, img, accent, Icon, cta, onClick }) => (
              <button
                key={key}
                type="button"
                className="home-action-card"
                onClick={onClick}
                style={{ '--card-accent': accent }}
              >
                <div className="home-action-bg" style={{ backgroundImage: `url(${img})` }} aria-hidden="true" />
                <div className="home-action-overlay" aria-hidden="true" />
                <div className="home-action-body">
                  <div className="home-action-icon">
                    <span style={{ width: 20, height: 20, display: 'inline-flex' }}><Icon /></span>
                  </div>
                  <div className="home-action-label">{label}</div>
                  <div className="home-action-sub">{sub}</div>
                  <div className="home-action-cta">{cta} →</div>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    );
  }

  SpotMe.HomeFeed = HomeFeed;
  SpotMe.FitAvatar = Avatar;
})();
