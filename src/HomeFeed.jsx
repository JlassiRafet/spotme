/* ============================================================
   SpotMe — HomeFeed
   Logged-in home: hero, category chips, program cards.
     - Hero headline + avatar + bell
     - Category filter chips (All / Cardio / Muscle / Diet)
     - Vertical stack of program cards in mint / lime / orange variants
   Clicking a category narrows the visible cards in-place; clicking
   "See all" hands off to the Programs tab.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useMemo } = React;
  const { BellIcon } = SpotMe.icons;

  const CATEGORIES = [
    { id: 'all',    label: 'All' },
    { id: 'cardio', label: 'Cardio' },
    { id: 'muscle', label: 'Muscle Building' },
    { id: 'diet',   label: 'Diet' }
  ];

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
        {profile?.avatarUrl
          ? <img src={profile.avatarUrl} alt="" />
          : initial}
      </Tag>
    );
  }

  function ProgramCard({ program, onClick }) {
    const variant = `fit-card-${program.coverColor || 'dark'}`;
    return (
      <article
        className={`fit-card ${variant}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      >
        {program.coverImage && (
          <div className="fit-card-img" aria-hidden="true">
            <img src={program.coverImage} alt="" loading="lazy" />
          </div>
        )}
        <div className="fit-card-meta">
          {program.difficulty && <span className="fit-card-pill">{program.difficulty}</span>}
        </div>
        <div>
          <span className="fit-card-tag">{program.category}</span>
          <h3 className="fit-card-title">{program.name}</h3>
          {program.totalMinutes != null && program.totalCalories != null && (
            <div className="fit-card-sub">
              {program.totalMinutes} min · {program.totalCalories} kcal
            </div>
          )}
        </div>
      </article>
    );
  }

  function HomeFeed({ profile, onNavigate, onOpenProfile, onOpenBell }) {
    const [category, setCategory] = useState('all');
    const [programs, setPrograms] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      setPrograms(null);
      setError(null);
      SpotMe.api.listPrograms('all').then(r => {
        if (cancelled) return;
        if (r.ok) setPrograms(r.data.programs || []);
        else setError(r.error || 'Could not load programs.');
      });
      return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
      if (!programs) return null;
      if (category === 'all') return programs;
      return programs.filter(p => p.category === category);
    }, [programs, category]);

    return (
      <div className="fit-home">
        <div className="fit-page">
          <header className="fit-hero">
            <h1 className="h-display">
              <em>Track your fitness</em>
              <em>Your way, every day</em>
            </h1>
            <div className="fit-hero-actions">
              <Avatar profile={profile} size={44} onClick={onOpenProfile} />
              <button
                type="button"
                className="fit-icon-btn"
                onClick={onOpenBell}
                aria-label="Notifications"
                style={{ position: 'relative' }}
              >
                <span style={{ width: 18, height: 18, display: 'inline-flex' }}>
                  <BellIcon active />
                </span>
                <span className="dot" />
              </button>
            </div>
          </header>

          <div className="fit-chips" role="tablist" aria-label="Category filter">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                className={`fit-chip${category === c.id ? ' is-active' : ''}`}
                onClick={() => {
                  setCategory(c.id);
                  if (c.id !== 'all') {
                    onNavigate('programs', { category: c.id });
                  }
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="fit-cards">
            {programs === null && (
              <div className="fit-loading"><span className="fit-spinner" />Loading your programs…</div>
            )}
            {error && (
              <div className="fit-empty">
                <div className="fit-empty-title">Couldn't load programs</div>
                <div>{error}</div>
              </div>
            )}
            {filtered && filtered.length === 0 && (
              <div className="fit-empty">
                <div className="fit-empty-title">No programs in this category yet</div>
                <div>Try another filter.</div>
              </div>
            )}
            {filtered && filtered.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                onClick={() => onNavigate('program', {
                  programId: p.id,
                  from: { name: 'home' }
                })}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  SpotMe.HomeFeed = HomeFeed;
  SpotMe.FitAvatar = Avatar;
})();
