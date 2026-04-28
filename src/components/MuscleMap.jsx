/* ============================================================
   SpotMe — MuscleMap
   Inline SVG front + back body diagram that highlights the muscle
   groups worked by a given exercise.
   Usage:  <SpotMe.MuscleMap tips={tipsText} />
   Parses "Primary: hamstrings, gluteus maximus…" from the tips
   string and maps anatomical names to visual muscle regions.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  /* ── Anatomy name → muscle region ID ─────────────────────── */
  const ALIASES = {
    'pectoralis major': 'chest', 'pectoralis': 'chest',
    'chest': 'chest', 'pec': 'chest', 'pecs': 'chest',
    'anterior deltoid': 'shoulders', 'medial deltoid': 'shoulders',
    'deltoid': 'shoulders', 'delts': 'shoulders',
    'shoulders': 'shoulders', 'shoulder': 'shoulders',
    'rear deltoid': 'rear-delts', 'posterior deltoid': 'rear-delts',
    'rear delts': 'rear-delts', 'rear delt': 'rear-delts',
    'triceps brachii': 'triceps', 'triceps': 'triceps', 'tricep': 'triceps',
    'biceps brachii': 'biceps', 'biceps': 'biceps', 'bicep': 'biceps',
    'brachialis': 'biceps',
    'brachioradialis': 'forearms', 'forearms': 'forearms', 'forearm': 'forearms',
    'latissimus dorsi': 'lats', 'lats': 'lats', 'lat': 'lats',
    'teres major': 'lats',
    'trapezius': 'traps', 'upper trapezius': 'traps', 'traps': 'traps', 'trap': 'traps',
    'rhomboids': 'upper-back', 'mid trapezius': 'upper-back',
    'erector spinae': 'lower-back', 'lower back': 'lower-back',
    'abdominals': 'abs', 'abs': 'abs', 'core': 'abs', 'rectus abdominis': 'abs',
    'quadriceps': 'quads', 'quads': 'quads', 'quad': 'quads', 'adductors': 'quads',
    'hamstrings': 'hamstrings', 'hamstring': 'hamstrings',
    'biceps femoris': 'hamstrings', 'semitendinosus': 'hamstrings', 'semimembranosus': 'hamstrings',
    'gluteus maximus': 'glutes', 'glutes': 'glutes', 'glute': 'glutes',
    'gastrocnemius': 'calves', 'calves': 'calves', 'calf': 'calves', 'soleus': 'calves',
  };

  function parseMuscles(tips) {
    if (!tips) return [];
    const match = tips.match(/^Primary:\s*([^.\n]+)/i);
    if (!match) return [];
    const ids = new Set();
    match[1].split(',').forEach(part => {
      const clean = part.trim().toLowerCase().replace(/\s*\(.*?\)/g, '');
      if (ALIASES[clean]) ids.add(ALIASES[clean]);
    });
    return [...ids];
  }

  /* ── SVG muscle style ─────────────────────────────────────── */
  function ms(active) {
    return {
      fill:        active ? 'rgba(45,212,191,0.45)' : 'rgba(255,255,255,0.05)',
      stroke:      active ? '#2dd4bf'               : 'rgba(255,255,255,0.1)',
      strokeWidth: active ? 1.5 : 0.5,
      filter:      active ? 'drop-shadow(0 0 5px rgba(45,212,191,0.55))' : 'none',
      transition:  'all 0.3s ease',
    };
  }

  /* ── Shared body silhouette ───────────────────────────────── */
  const SILHOUETTE = (
    <g fill="#1a1a1c" stroke="#2a2a2e" strokeWidth="0.6">
      <circle cx="28" cy="8" r="7" />
      <rect x="25" y="15" width="6" height="6" rx="1.5" />
      <path d="M15,21 Q9,23 8,30 L8,73 Q8,75 11,75 L21,75 L21,72 L13,72 L13,34 Q17,27 28,25 Q39,27 43,34 L43,72 L35,72 L35,75 L45,75 Q48,75 48,73 L48,30 Q47,23 41,21 Q35,19 28,19 Q21,19 15,21 Z" />
      <path d="M8,30 Q3,33 3,42 L3,57 Q3,59 5,59 L10,59 L14,35" />
      <path d="M48,30 Q53,33 53,42 L53,57 Q53,59 51,59 L46,59 L42,35" />
      <path d="M3,59 Q2,68 3,76 L8,76 L10,59" />
      <path d="M53,59 Q54,68 53,76 L48,76 L46,59" />
      <path d="M13,75 L11,85 Q10,95 10,108 L10,116 Q10,118 12,118 L20,118 L20,75" />
      <path d="M43,75 L45,85 Q46,95 46,108 L46,116 Q46,118 44,118 L36,118 L36,75" />
      <path d="M10,116 L10,130 Q10,133 12,133 L20,133 L20,116" />
      <path d="M46,116 L46,130 Q46,133 44,133 L36,133 L36,116" />
    </g>
  );

  /* ── Front view ───────────────────────────────────────────── */
  function FrontView({ active }) {
    const a = new Set(active);
    return (
      <svg viewBox="0 0 56 142" xmlns="http://www.w3.org/2000/svg" className="muscle-map-svg">
        {SILHOUETTE}
        <ellipse cx="9.5"  cy="33"  rx="6"   ry="5.5" style={ms(a.has('shoulders'))} />
        <ellipse cx="46.5" cy="33"  rx="6"   ry="5.5" style={ms(a.has('shoulders'))} />
        <ellipse cx="21"   cy="43"  rx="8.5" ry="7.5" style={ms(a.has('chest'))} />
        <ellipse cx="35"   cy="43"  rx="8.5" ry="7.5" style={ms(a.has('chest'))} />
        <ellipse cx="6"    cy="46"  rx="3.5" ry="6.5" style={ms(a.has('biceps'))} />
        <ellipse cx="50"   cy="46"  rx="3.5" ry="6.5" style={ms(a.has('biceps'))} />
        <ellipse cx="5.5"  cy="67"  rx="3"   ry="7"   style={ms(a.has('forearms'))} />
        <ellipse cx="50.5" cy="67"  rx="3"   ry="7"   style={ms(a.has('forearms'))} />
        <ellipse cx="23"   cy="57"  rx="4"   ry="4"   style={ms(a.has('abs'))} />
        <ellipse cx="33"   cy="57"  rx="4"   ry="4"   style={ms(a.has('abs'))} />
        <ellipse cx="23"   cy="65"  rx="4"   ry="4"   style={ms(a.has('abs'))} />
        <ellipse cx="33"   cy="65"  rx="4"   ry="4"   style={ms(a.has('abs'))} />
        <ellipse cx="23"   cy="73"  rx="3.5" ry="3.5" style={ms(a.has('abs'))} />
        <ellipse cx="33"   cy="73"  rx="3.5" ry="3.5" style={ms(a.has('abs'))} />
        <ellipse cx="16"   cy="98"  rx="5.5" ry="11"  style={ms(a.has('quads'))} />
        <ellipse cx="40"   cy="98"  rx="5.5" ry="11"  style={ms(a.has('quads'))} />
        <ellipse cx="15"   cy="123" rx="4.5" ry="8"   style={ms(a.has('calves'))} />
        <ellipse cx="41"   cy="123" rx="4.5" ry="8"   style={ms(a.has('calves'))} />
      </svg>
    );
  }

  /* ── Back view ────────────────────────────────────────────── */
  function BackView({ active }) {
    const a = new Set(active);
    return (
      <svg viewBox="0 0 56 142" xmlns="http://www.w3.org/2000/svg" className="muscle-map-svg">
        {SILHOUETTE}
        <ellipse cx="28"   cy="29"  rx="12"  ry="5"   style={ms(a.has('traps'))} />
        <ellipse cx="28"   cy="39"  rx="10"  ry="5"   style={ms(a.has('upper-back'))} />
        <ellipse cx="9.5"  cy="33"  rx="6"   ry="5.5" style={ms(a.has('rear-delts'))} />
        <ellipse cx="46.5" cy="33"  rx="6"   ry="5.5" style={ms(a.has('rear-delts'))} />
        <ellipse cx="17"   cy="53"  rx="7.5" ry="13"  style={ms(a.has('lats'))} />
        <ellipse cx="39"   cy="53"  rx="7.5" ry="13"  style={ms(a.has('lats'))} />
        <ellipse cx="28"   cy="67"  rx="9"   ry="6"   style={ms(a.has('lower-back'))} />
        <ellipse cx="6"    cy="46"  rx="3.5" ry="6.5" style={ms(a.has('triceps'))} />
        <ellipse cx="50"   cy="46"  rx="3.5" ry="6.5" style={ms(a.has('triceps'))} />
        <ellipse cx="19"   cy="81"  rx="8"   ry="6.5" style={ms(a.has('glutes'))} />
        <ellipse cx="37"   cy="81"  rx="8"   ry="6.5" style={ms(a.has('glutes'))} />
        <ellipse cx="16"   cy="99"  rx="5.5" ry="11"  style={ms(a.has('hamstrings'))} />
        <ellipse cx="40"   cy="99"  rx="5.5" ry="11"  style={ms(a.has('hamstrings'))} />
        <ellipse cx="15"   cy="123" rx="4.5" ry="8"   style={ms(a.has('calves'))} />
        <ellipse cx="41"   cy="123" rx="4.5" ry="8"   style={ms(a.has('calves'))} />
      </svg>
    );
  }

  const FRONT_GROUPS = ['shoulders','chest','biceps','forearms','abs','quads','calves'];
  const BACK_GROUPS  = ['traps','upper-back','rear-delts','lats','lower-back','triceps','glutes','hamstrings','calves'];

  const LABEL = {
    shoulders: 'Shoulders', chest: 'Chest', biceps: 'Biceps', forearms: 'Forearms',
    abs: 'Abs', quads: 'Quads', calves: 'Calves', traps: 'Traps',
    'upper-back': 'Upper Back', 'rear-delts': 'Rear Delts', lats: 'Lats',
    'lower-back': 'Lower Back', triceps: 'Triceps', glutes: 'Glutes', hamstrings: 'Hamstrings',
  };

  /* ── Main exported component ──────────────────────────────── */
  function MuscleMap({ tips }) {
    const muscles = parseMuscles(tips);
    if (!muscles.length) return null;

    const hasFront = muscles.some(m => FRONT_GROUPS.includes(m));
    const hasBack  = muscles.some(m => BACK_GROUPS.includes(m));

    return (
      <div className="muscle-map">
        <div className="muscle-map-label">Muscles worked</div>
        <div className="muscle-map-views">
          {(hasFront || !hasBack) && (
            <div className="muscle-map-view">
              <FrontView active={muscles} />
              <span className="muscle-map-view-label">Front</span>
            </div>
          )}
          {hasBack && (
            <div className="muscle-map-view">
              <BackView active={muscles} />
              <span className="muscle-map-view-label">Back</span>
            </div>
          )}
        </div>
        <div className="muscle-map-badges">
          {muscles.map(m => (
            <span key={m} className="muscle-map-badge">{LABEL[m] || m}</span>
          ))}
        </div>
      </div>
    );
  }

  SpotMe.MuscleMap = MuscleMap;
})();
