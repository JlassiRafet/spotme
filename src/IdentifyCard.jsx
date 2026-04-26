/* ============================================================
   SpotMe — IdentifyCard
   Rich structured card for gym equipment identification results.
   Rendered when user uploads a machine photo in ChatPage.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  /* ── Muscle → body position map (100×180 viewBox) ──────────── */
  /* cx < 48 = left-side muscle → mirrored to right automatically  */
  const MUSCLE_POSITIONS = {
    // Front-view muscles
    'Pectoralis Major':    { view: 'front', cx: 50, cy: 52, rx: 16, ry:  9, mid: true },
    'Pectoralis Minor':    { view: 'front', cx: 50, cy: 44, rx: 10, ry:  5, mid: true },
    'Anterior Deltoid':    { view: 'front', cx: 23, cy: 44, rx:  6, ry:  7 },
    'Lateral Deltoid':     { view: 'front', cx: 17, cy: 47, rx:  4, ry:  6 },
    'Biceps Brachii':      { view: 'front', cx: 14, cy: 60, rx:  4, ry: 10 },
    'Forearms':            { view: 'front', cx: 12, cy: 78, rx:  4, ry:  9 },
    'Rectus Abdominis':    { view: 'front', cx: 50, cy: 70, rx: 10, ry: 12, mid: true },
    'Obliques':            { view: 'front', cx: 31, cy: 70, rx:  6, ry: 11 },
    'Quadriceps':          { view: 'front', cx: 38, cy: 116, rx:  8, ry: 17 },
    'Adductors':           { view: 'front', cx: 46, cy: 113, rx:  4, ry: 14 },
    'Hip Flexors':         { view: 'front', cx: 50, cy: 88,  rx: 12, ry:  5, mid: true },
    'Tibialis Anterior':   { view: 'front', cx: 38, cy: 150, rx:  5, ry: 12 },
    // Back-view muscles
    'Posterior Deltoid':   { view: 'back',  cx: 23, cy: 44, rx:  6, ry:  7 },
    'Triceps Brachii':     { view: 'back',  cx: 14, cy: 60, rx:  4, ry: 10 },
    'Upper Trapezius':     { view: 'back',  cx: 50, cy: 38, rx: 18, ry:  5, mid: true },
    'Middle Trapezius':    { view: 'back',  cx: 50, cy: 46, rx: 13, ry:  5, mid: true },
    'Lower Trapezius':     { view: 'back',  cx: 50, cy: 53, rx:  9, ry:  5, mid: true },
    'Latissimus Dorsi':    { view: 'back',  cx: 31, cy: 60, rx:  9, ry: 16 },
    'Rhomboids':           { view: 'back',  cx: 50, cy: 46, rx:  9, ry:  7, mid: true },
    'Erector Spinae':      { view: 'back',  cx: 50, cy: 68, rx:  6, ry: 16, mid: true },
    'Gluteus Maximus':     { view: 'back',  cx: 50, cy: 90, rx: 14, ry:  8, mid: true },
    'Gluteus Medius':      { view: 'back',  cx: 30, cy: 86, rx:  7, ry:  7 },
    'Hamstrings':          { view: 'back',  cx: 38, cy: 116, rx:  8, ry: 17 },
    'Calves':              { view: 'back',  cx: 38, cy: 150, rx:  6, ry: 12 },
    'Soleus':              { view: 'back',  cx: 38, cy: 158, rx:  5, ry:  7 },
    'Abductors':           { view: 'back',  cx: 27, cy: 102, rx:  5, ry: 13 },
  };

  /* ── Human-curved body silhouette paths (100×180 viewBox) ──── */
  const BODY_PATHS = [
    // Neck
    'M46,22 C45,25 45,28 45,31 L55,31 C55,28 55,25 54,22 Z',
    // Torso — shoulders wide, waist in, hips out
    'M28,32 C22,35 20,42 22,54 C22,64 26,73 28,81 C30,89 33,94 37,97 L63,97 C67,94 70,89 72,81 C74,73 78,64 78,54 C80,42 78,35 72,32 C64,27 56,25 50,25 C44,25 36,27 28,32 Z',
    // Left upper arm — rounded deltoid-to-elbow taper
    'M20,40 C13,43 9,52 10,63 C11,71 14,77 18,79 C22,77 23,70 22,60 C22,51 22,45 20,40 Z',
    // Right upper arm
    'M80,40 C87,43 91,52 90,63 C89,71 86,77 82,79 C78,77 77,70 78,60 C78,51 78,45 80,40 Z',
    // Left forearm — tapers to wrist
    'M10,63 C7,70 6,79 8,87 C10,93 14,97 17,95 C19,91 20,83 18,76 C14,71 12,67 10,63 Z',
    // Right forearm
    'M90,63 C93,70 94,79 92,87 C90,93 86,97 83,95 C81,91 80,83 82,76 C86,71 88,67 90,63 Z',
    // Left thigh — wider at top, knee narrowing
    'M34,97 C27,102 25,113 27,126 C29,137 34,142 40,144 C46,142 49,136 49,126 C49,114 47,103 43,97 Z',
    // Right thigh
    'M66,97 C73,102 75,113 73,126 C71,137 66,142 60,144 C54,142 51,136 51,126 C51,114 53,103 57,97 Z',
    // Left calf — calf bulge then taper to ankle
    'M27,126 C25,137 25,150 27,159 C29,166 35,171 40,172 C45,171 49,166 49,159 C49,150 49,142 40,144 C34,142 29,137 27,126 Z',
    // Right calf
    'M73,126 C75,137 75,150 73,159 C71,166 65,171 60,172 C55,171 51,166 51,159 C51,150 51,142 60,144 C66,142 71,137 73,126 Z',
  ];

  function BodyDiagram({ view, primaryMuscles, secondaryMuscles }) {
    const primary   = new Set((primaryMuscles   || []).map(m => m.toLowerCase()));
    const secondary = new Set((secondaryMuscles || []).map(m => m.toLowerCase()));
    const viewMuscles = Object.entries(MUSCLE_POSITIONS).filter(([, p]) => p.view === view);

    const highlights = [];
    viewMuscles.forEach(([name, pos]) => {
      const isPrimary   = primary.has(name.toLowerCase());
      const isSecondary = secondary.has(name.toLowerCase());
      if (!isPrimary && !isSecondary) return;
      const fill   = isPrimary ? 'rgba(255,110,50,0.72)' : 'rgba(80,165,255,0.55)';
      const stroke = isPrimary ? '#ff7040' : '#4fa8ff';
      const rx = isPrimary ? pos.rx : pos.rx * 0.9;
      const ry = isPrimary ? pos.ry : pos.ry * 0.9;
      highlights.push(
        <ellipse key={name} cx={pos.cx} cy={pos.cy} rx={rx} ry={ry}
                 fill={fill} stroke={stroke} strokeWidth="0.6">
          <title>{name}</title>
        </ellipse>
      );
      // Mirror bilateral muscles (left-side cx < 48) onto right side
      if (!pos.mid && pos.cx < 48) {
        highlights.push(
          <ellipse key={name + '_r'} cx={100 - pos.cx} cy={pos.cy} rx={rx} ry={ry}
                   fill={fill} stroke={stroke} strokeWidth="0.6">
            <title>{name}</title>
          </ellipse>
        );
      }
    });

    return (
      <svg viewBox="0 0 100 180" width="88" height="158" className="muscle-body-svg"
           aria-label={`${view} body muscle diagram`}>
        {/* Head */}
        <circle cx="50" cy="13" r="10.5"
                fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" />
        {/* Organic body silhouette */}
        {BODY_PATHS.map((d, i) => (
          <path key={i} d={d}
                fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" />
        ))}
        {/* Muscle highlights */}
        {highlights}
      </svg>
    );
  }

  function IdentifyCard({ ident }) {
    const allMuscles = [...(ident.primaryMuscles || []), ...(ident.secondaryMuscles || [])];
    const hasFront = allMuscles.some(m => MUSCLE_POSITIONS[m]?.view === 'front');
    const hasBack  = allMuscles.some(m => MUSCLE_POSITIONS[m]?.view === 'back');

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(ident.machineName + ' gym machine')}&tbm=isch`;

    return (
      <div className="identify-card">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="identify-header">
          <div className="identify-header-left">
            <h2 className="identify-machine-name">{ident.machineName}</h2>
            <span className="identify-category-badge">{ident.category}</span>
          </div>
          <a href={searchUrl} target="_blank" rel="noopener noreferrer"
             className="identify-image-link" title="See machine photos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            See photos
          </a>
        </div>

        {/* ── Muscle section ───────────────────────────────────── */}
        <div className="identify-muscle-wrap">
          {/* Body diagrams */}
          {(hasFront || hasBack) && (
            <div className="identify-body-maps">
              {hasFront && (
                <div className="muscle-map-panel">
                  <div className="muscle-map-view-label">Front</div>
                  <BodyDiagram view="front"
                    primaryMuscles={ident.primaryMuscles}
                    secondaryMuscles={ident.secondaryMuscles} />
                </div>
              )}
              {hasBack && (
                <div className="muscle-map-panel">
                  <div className="muscle-map-view-label">Back</div>
                  <BodyDiagram view="back"
                    primaryMuscles={ident.primaryMuscles}
                    secondaryMuscles={ident.secondaryMuscles} />
                </div>
              )}
              {/* Legend */}
              <div className="muscle-map-legend">
                <span className="legend-dot primary" />Primary
                <span className="legend-dot secondary" />Secondary
              </div>
            </div>
          )}

          {/* Muscle pill lists */}
          <div className="identify-muscle-lists">
            {ident.primaryMuscles && ident.primaryMuscles.length > 0 && (
              <div className="identify-muscle-group">
                <div className="identify-muscle-group-label">Primary</div>
                <div className="identify-muscle-pills">
                  {ident.primaryMuscles.map(m => (
                    <span key={m} className="muscle-pill primary">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {ident.secondaryMuscles && ident.secondaryMuscles.length > 0 && (
              <div className="identify-muscle-group">
                <div className="identify-muscle-group-label secondary">Secondary</div>
                <div className="identify-muscle-pills">
                  {ident.secondaryMuscles.map(m => (
                    <span key={m} className="muscle-pill secondary">{m}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Steps ────────────────────────────────────────────── */}
        {ident.steps && ident.steps.length > 0 && (
          <div className="identify-steps-section">
            <div className="identify-section-title">How to use it</div>
            <ol className="identify-steps-list">
              {ident.steps.map((step, i) => (
                <li key={i} className="identify-step">
                  <span className="identify-step-num">{i + 1}</span>
                  <span className="identify-step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── Pro tip + Safety ─────────────────────────────────── */}
        {(ident.proTip || ident.safetyNote) && (
          <div className="identify-tips-row">
            {ident.proTip && (
              <div className="identify-tip-card pro">
                <div className="identify-tip-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 2a7 7 0 0 1 7 7c0 3.38-2.4 6.18-5.6 6.84V18a1 1 0 0 1-1 1h-2.8a1 1 0 0 1-1-1v-2.16C5.4 15.18 3 12.38 3 9a7 7 0 0 1 7-7h2z"/>
                    <line x1="9" y1="21" x2="15" y2="21"/>
                  </svg>
                </div>
                <div>
                  <div className="identify-tip-label">Pro tip</div>
                  <div className="identify-tip-text">{ident.proTip}</div>
                </div>
              </div>
            )}
            {ident.safetyNote && (
              <div className="identify-tip-card safety">
                <div className="identify-tip-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <div className="identify-tip-label">Safety</div>
                  <div className="identify-tip-text">{ident.safetyNote}</div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    );
  }

  SpotMe.IdentifyCard = IdentifyCard;
})();
