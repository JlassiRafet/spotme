/* ============================================================
   SpotMe — ProgramsPage
   Grid of program cards filtered by category. Reuses the same
   ProgramCard styling as HomeFeed; on tap routes to the detail
   screen carrying { programId, from }.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useMemo } = React;
  const { ArrowLeftIcon } = SpotMe.icons;

  const CATEGORIES = [
    { id: 'all',    label: 'All' },
    { id: 'cardio', label: 'Cardio' },
    { id: 'muscle', label: 'Muscle Building' },
    { id: 'diet',   label: 'Diet' }
  ];

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

  function ProgramsPage({ route, onNavigate, onBack }) {
    const [category, setCategory] = useState(route?.category || 'all');
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

    useEffect(() => {
      if (route?.category) setCategory(route.category);
    }, [route?.category]);

    const filtered = useMemo(() => {
      if (!programs) return null;
      if (category === 'all') return programs;
      return programs.filter(p => p.category === category);
    }, [programs, category]);

    return (
      <div className="fit-home">
        <header className="fit-topbar">
          <button
            type="button"
            className="fit-icon-btn"
            onClick={onBack}
            aria-label="Back"
          >
            <span style={{ width: 18, height: 18, display: 'inline-flex' }}><ArrowLeftIcon /></span>
          </button>
          <h1 className="fit-topbar-title">Programs</h1>
          <div style={{ width: 40 }} />
        </header>

        <div className="fit-page">
          <div className="fit-chips" role="tablist">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                className={`fit-chip${category === c.id ? ' is-active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <h2 className="fit-section-title">Featured programs</h2>

          {programs === null && (
            <div className="fit-loading"><span className="fit-spinner" />Loading…</div>
          )}
          {error && (
            <div className="fit-empty">
              <div className="fit-empty-title">Couldn't load programs</div>
              <div>{error}</div>
            </div>
          )}
          <div className="fit-programs-grid">
            {filtered && filtered.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                onClick={() => onNavigate('program', {
                  programId: p.id,
                  from: { name: 'programs', category }
                })}
              />
            ))}
          </div>
          {filtered && filtered.length === 0 && (
            <div className="fit-empty">
              <div className="fit-empty-title">No programs in this category yet</div>
              <div>Try another filter.</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  SpotMe.ProgramsPage = ProgramsPage;
})();
