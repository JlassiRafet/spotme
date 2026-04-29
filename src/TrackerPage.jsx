/* ============================================================
   SpotMe — TrackerPage
   Workout Memory + Progress Engine. Contains:
     • StreakCard      — daily streak with fire animation
     • StatsCard       — weekly summary + PRs
   • QuickAddCard    — zero-friction workout logger
   • SmartSuggestions — contextual nudges
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useCallback, useRef, useMemo } = React;

  /* ── Muscle group options ─────────────────────────────────── */
  const MUSCLE_GROUPS = [
    { id: 'chest',     label: 'Chest',     emoji: '🫁' },
    { id: 'back',      label: 'Back',      emoji: '🔙' },
    { id: 'legs',      label: 'Legs',      emoji: '🦵' },
    { id: 'shoulders', label: 'Shoulders', emoji: '💪' },
    { id: 'arms',      label: 'Arms',      emoji: '💪' },
    { id: 'core',      label: 'Core',      emoji: '🎯' },
  ];

  /* ── Greeting header (mirrors Image 1 "Hello, Kate!") ─── */
  function TrackerGreeting({ name }) {
    const first = (name || '').trim().split(' ')[0] || 'there';
    return (
      <header className="tracker-greeting">
        <div className="tracker-greeting-eyebrow">Hello, {first}!</div>
        <h1 className="tracker-greeting-title">This is your progress.</h1>
      </header>
    );
  }

  /* ── Volume goal card — partial-arc ring (Image 1 "Calories") ── */
  function VolumeGoalCard({ stats }) {
    const weekly = stats?.weeklyActivity || [];
    const total = weekly.reduce((s, d) => s + (d.count || 0), 0);
    const goal = 5;
    const ratio = Math.max(0, Math.min(total / goal, 1));
    const pct = Math.round(ratio * 100);

    const R = 36;
    const C = 2 * Math.PI * R;
    const dash = ratio * C;

    return (
      <div className="chart-card volume-goal-card">
        <h4 className="chart-title">Weekly Goal</h4>
        <div className="volume-goal-body">
          <svg viewBox="0 0 100 100" className="volume-goal-svg" aria-hidden="true">
            <defs>
              <linearGradient id="volGoalGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#E57399" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={R}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="9" />
            <circle cx="50" cy="50" r={R}
                    fill="transparent"
                    stroke="url(#volGoalGrad)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${C}`}
                    transform="rotate(-90 50 50)"
                    className="volume-goal-arc" />
          </svg>
          <div className="volume-goal-center">
            <div className="volume-goal-pct">{pct}%</div>
          </div>
        </div>
        <div className="volume-goal-meta">
          <strong>{total}</strong>
          <span>of {goal} workouts</span>
        </div>
      </div>
    );
  }

  /* ── Personal Records Card ───────────────────────────────── */
  function PRCard({ prs, onDeleted }) {
    const [deletingId, setDeletingId] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null); // { pr, workoutId }
    const [deleteError, setDeleteError] = useState('');

    const resolveWorkoutId = (pr) => {
      const w =
        pr.workoutId ??
        pr.workoutLogId ??
        pr.workout_id ??
        pr.workout_log_id;
      if (w === null || w === undefined || w === '') return null;
      const n = Number(w);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const closeDeleteModal = useCallback(() => {
      setPendingDelete(null);
      setDeleteError('');
    }, []);

    useEffect(() => {
      if (!pendingDelete) return undefined;
      const onKey = (e) => {
        if (e.key === 'Escape' && deletingId === null) closeDeleteModal();
      };
      document.addEventListener('keydown', onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = prev;
      };
    }, [pendingDelete, deletingId, closeDeleteModal]);

    const openDeleteModal = (pr) => {
      const workoutId = resolveWorkoutId(pr);
      setDeleteError('');
      setPendingDelete({ pr, workoutId });
    };

    const executeDelete = async () => {
      const wid = pendingDelete?.workoutId;
      if (!wid) return;
      setDeletingId(wid);
      const r = await SpotMe.api.deleteWorkoutLog(wid);
      setDeletingId(null);
      if (!r.ok) {
        setDeleteError(r.error || 'Something went wrong. Please try again.');
        return;
      }
      closeDeleteModal();
      if (typeof onDeleted === 'function') await onDeleted();
    };

    if (!prs || prs.length === 0) return null;

    return (
      <>
        <div className="chart-card prs-card">
          <h4 className="chart-title">Personal Records</h4>
          <div className="prs-grid">
            {prs.map((pr, i) => {
              const workoutId = resolveWorkoutId(pr);
              return (
                <div key={workoutId ?? `pr-${i}-${pr.exercise}`} className="pr-card">
                  <div className="pr-info">
                    <span className="pr-name">{pr.exercise}</span>
                    <span className="pr-date">{new Date(pr.date * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="pr-card-right">
                    <div className="pr-stats">
                      <div className="pr-weight">{pr.weight}kg</div>
                      <div className="pr-delta">↑ New Peak</div>
                    </div>
                    {workoutId != null && (
                      <button
                        type="button"
                        className="pr-delete-btn"
                        disabled={deletingId === workoutId}
                        onClick={() => openDeleteModal(pr)}
                        aria-label={`Delete workout for ${pr.exercise}`}
                        title="Delete this workout log"
                      >
                        {deletingId === workoutId ? '…' : '×'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pendingDelete && pendingDelete.pr && pendingDelete.workoutId != null && (
          <div
            className="pr-delete-modal-overlay"
            onClick={(e) => {
              if (deletingId !== null) return;
              if (e.target === e.currentTarget) closeDeleteModal();
            }}
          >
            <div
              className="pr-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pr-delete-modal-title"
              onClick={e => e.stopPropagation()}
            >
              <h3 id="pr-delete-modal-title" className="pr-delete-modal-title">Remove workout log?</h3>

              <p className="pr-delete-modal-lead">
                This deletes the logged session for{' '}
                <strong>{pendingDelete.pr.exercise}</strong>
                {' '}·{' '}
                <strong>{pendingDelete.pr.weight}&nbsp;kg</strong>
                {' '}·{' '}
                {new Date(pendingDelete.pr.date * 1000).toLocaleDateString()}
              </p>

              <p className="pr-delete-modal-body">
                Weekly stats and your PR board update after removal. You can’t undo from the app.
              </p>

              {deleteError !== '' ? (
                <div className="pr-delete-modal-error" role="alert">{deleteError}</div>
              ) : null}

              <div className="pr-delete-modal-actions">
                <button
                  type="button"
                  className="pr-delete-modal-btn pr-delete-modal-btn-secondary"
                  onClick={closeDeleteModal}
                  disabled={deletingId !== null}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pr-delete-modal-btn pr-delete-modal-btn-danger"
                  onClick={() => executeDelete()}
                  disabled={deletingId !== null}
                >
                  {deletingId !== null ? 'Removing…' : 'Remove log'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── SmartSuggestions ─────────────────────────────────────── */
  function SmartSuggestions({ suggestions }) {
    if (!suggestions || suggestions.length === 0) return null;
    return (
      <div className="tracker-suggestions">
        {suggestions.map((s, i) => (
          <div key={i} className={`suggestion-card suggestion-${s.type}`}>
            <span className="suggestion-text">{s.text}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ── QuickAddCard ─────────────────────────────────────────── */
  function QuickAddCard({ recentExercises, onLog, weightUnit }) {
    const [exercise, setExercise] = useState('');
    const [muscleGroup, setMuscleGroup] = useState('');
    const [sets, setSets] = useState([{ reps: '', weight: '' }]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const inputRef = useRef(null);

    const filtered = useMemo(() => {
      if (!exercise.trim() || !recentExercises) return [];
      const q = exercise.toLowerCase();
      return recentExercises.filter(r => r.exercise.toLowerCase().includes(q));
    }, [exercise, recentExercises]);

    const suggestRows = Math.min(6, filtered.length);
    const suggestionsOpen = showSuggestions && suggestRows > 0;
    const ROW_H = 44;
    const QUICK_ADD_WRAP_MB = 14;
    const suggestReserve = suggestionsOpen ? QUICK_ADD_WRAP_MB + 4 + suggestRows * ROW_H : 0;

    const pickExercise = (rec) => {
      setExercise(rec.exercise);
      setMuscleGroup(rec.muscleGroup || '');
      // Pre-fill last used sets
      if (rec.lastSets && rec.lastSets.length > 0) {
        setSets(rec.lastSets.map(s => ({
          reps: String(s.reps || ''),
          weight: String(s.weight || '')
        })));
      }
      setShowSuggestions(false);
      setExpanded(true);
    };

    const addSet = () => {
      const last = sets[sets.length - 1] || { reps: '', weight: '' };
      setSets([...sets, { reps: last.reps, weight: last.weight }]);
    };

    const removeSet = (i) => {
      if (sets.length <= 1) return;
      setSets(sets.filter((_, idx) => idx !== i));
    };

    const updateSet = (i, field, val) => {
      const copy = [...sets];
      copy[i] = { ...copy[i], [field]: val };
      setSets(copy);
    };

    const submit = async () => {
      if (!exercise.trim()) return;
      const validSets = sets
        .filter(s => s.reps || s.weight)
        .map(s => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }));
      if (validSets.length === 0) validSets.push({ reps: 0, weight: 0 });

      setSaving(true);
      const r = await SpotMe.api.logWorkout({
        exercise: exercise.trim(),
        sets: validSets,
        muscleGroup: muscleGroup,
        source: 'manual'
      });
      setSaving(false);

      if (r.ok) {
        setSaved(true);
        if (typeof onLog === 'function') {
          await onLog();
        }
        setTimeout(() => {
          setExercise('');
          setMuscleGroup('');
          setSets([{ reps: '', weight: '' }]);
          setSaved(false);
          setExpanded(false);
        }, 450);
      }
    };

    return (
      <div className={`tracker-quick-add${saved ? ' is-saved' : ''}`}>
        <div className="quick-add-header">
          <h3 className="quick-add-title">Log Workout</h3>
          {saved && <span className="quick-add-check">✓ Saved</span>}
        </div>

        {/* Exercise name */}
        <div
          className={`quick-add-exercise-wrap${suggestionsOpen ? ' is-suggesting' : ''}`}
          style={suggestionsOpen ? { marginBottom: suggestReserve } : undefined}
        >
          <input
            ref={inputRef}
            type="text"
            className="quick-add-input"
            placeholder="Exercise name…"
            value={exercise}
            onChange={e => { setExercise(e.target.value); setShowSuggestions(true); }}
            onFocus={() => { setShowSuggestions(true); setExpanded(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {suggestionsOpen && (
            <div className="quick-add-suggestions">
              {filtered.slice(0, 6).map((r, i) => (
                <button key={i} type="button" className="quick-add-suggestion"
                        onMouseDown={() => pickExercise(r)}>
                  <span className="suggestion-name">{r.exercise}</span>
                  {r.muscleGroup && <span className="suggestion-muscle">{r.muscleGroup}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {expanded && (
          <>
            {/* Muscle group chips */}
            <div className="muscle-chip-row">
              {MUSCLE_GROUPS.map(mg => (
                <button key={mg.id} type="button"
                        className={`muscle-chip${muscleGroup === mg.label ? ' is-selected' : ''}`}
                        onClick={() => setMuscleGroup(muscleGroup === mg.label ? '' : mg.label)}>
                  {mg.label}
                </button>
              ))}
            </div>

            {/* Set rows */}
            <div className="quick-add-sets">
              <div className="sets-header">
                <span className="sets-header-label">Set</span>
                <span className="sets-header-label">Reps</span>
                <span className="sets-header-label">Weight (kg)</span>
                <span style={{width: 28}} />
              </div>
              {sets.map((s, i) => (
                <div key={i} className="set-row">
                  <span className="set-num">{i + 1}</span>
                  <input type="number" inputMode="numeric" className="set-input"
                         placeholder="10" value={s.reps}
                         onChange={e => updateSet(i, 'reps', e.target.value)} />
                  <input type="number" inputMode="decimal" className="set-input"
                         placeholder="0" value={s.weight}
                         onChange={e => updateSet(i, 'weight', e.target.value)} />
                  <button type="button" className="set-remove"
                          onClick={() => removeSet(i)}
                          disabled={sets.length <= 1}
                          aria-label="Remove set">×</button>
                </div>
              ))}
              <button type="button" className="add-set-btn" onClick={addSet}>
                + Add set
              </button>
            </div>

            {/* Submit */}
            <button type="button" className="quick-add-submit"
                    onClick={submit} disabled={saving || !exercise.trim()}>
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Log Exercise'}
            </button>
          </>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     ML UTILITIES — pure JS, no external libraries
     Mirrors: KNN.ipynb · Lab3_Random_Forest · 02_unsupervised
     ══════════════════════════════════════════════════════════ */

  /** StandardScaler: returns { means, stds, transform(M) } */
  function mlScale(X) {
    const n = X.length, d = X[0].length;
    const means = Array(d).fill(0), stds = Array(d).fill(0);
    for (const r of X) r.forEach((v, j) => (means[j] += v));
    means.forEach((_, j) => (means[j] /= n));
    for (const r of X) r.forEach((v, j) => (stds[j] += (v - means[j]) ** 2));
    stds.forEach((_, j) => (stds[j] = Math.sqrt(stds[j] / n) || 1));
    return { means, stds, transform: M => M.map(r => r.map((v, j) => (v - means[j]) / stds[j])) };
  }

  /** LCG seeded RNG (matches numpy random_state=42 ordering) */
  function mlRand(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
  }

  /** Fisher-Yates seeded shuffle */
  function mlShuffle(arr, seed) {
    const a = [...arr]; const rng = mlRand(seed);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** train_test_split with random_state=42 */
  function mlSplit(X, y, testRatio, seed) {
    const idx = mlShuffle(X.map((_, i) => i), seed);
    const cut = Math.floor(X.length * (1 - testRatio));
    const ti = idx.slice(0, cut), vi = idx.slice(cut);
    return { Xtr: ti.map(i => X[i]), ytr: ti.map(i => y[i]), Xte: vi.map(i => X[i]), yte: vi.map(i => y[i]) };
  }

  function mlDist(a, b) { return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)); }

  /** KNeighborsClassifier — predict labels for Xte using k neighbors */
  function mlKNN(Xtr, ytr, Xte, k) {
    return Xte.map(q => {
      const sorted = Xtr.map((p, i) => [mlDist(q, p), ytr[i]]).sort((a, b) => a[0] - b[0]).slice(0, k);
      const v = {}; for (const [, l] of sorted) v[l] = (v[l] || 0) + 1;
      return Object.entries(v).sort((a, b) => b[1] - a[1])[0][0];
    });
  }

  /** DecisionTreeRegressor — recursive mean-split, maxDepth=3 */
  function mlBuildDT(X, y, depth, maxDepth) {
    const mean = y.reduce((s, v) => s + v, 0) / y.length;
    if (depth >= maxDepth || y.length <= 3) return { leaf: true, val: mean };
    let best = { mse: Infinity, fi: -1, th: 0 };
    for (let fi = 0; fi < X[0].length; fi++) {
      const vals = [...new Set(X.map(r => r[fi]))].sort((a, b) => a - b);
      for (let k = 0; k < vals.length - 1; k++) {
        const th = (vals[k] + vals[k + 1]) / 2;
        const L = [], R = [];
        X.forEach((r, i) => (r[fi] <= th ? L : R).push(y[i]));
        if (!L.length || !R.length) continue;
        const lm = L.reduce((s, v) => s + v, 0) / L.length;
        const rm = R.reduce((s, v) => s + v, 0) / R.length;
        const mse = (L.reduce((s, v) => s + (v - lm) ** 2, 0) + R.reduce((s, v) => s + (v - rm) ** 2, 0)) / (L.length + R.length);
        if (mse < best.mse) best = { mse, fi, th };
      }
    }
    if (best.fi === -1) return { leaf: true, val: mean };
    const LX = [], LY = [], RX = [], RY = [];
    X.forEach((r, i) => { if (r[best.fi] <= best.th) { LX.push(r); LY.push(y[i]); } else { RX.push(r); RY.push(y[i]); } });
    return { leaf: false, fi: best.fi, th: best.th, left: mlBuildDT(LX, LY, depth + 1, maxDepth), right: mlBuildDT(RX, RY, depth + 1, maxDepth) };
  }

  function mlPredDT(node, x) {
    return node.leaf ? node.val : (x[node.fi] <= node.th ? mlPredDT(node.left, x) : mlPredDT(node.right, x));
  }

  /** RandomForestRegressor — n_estimators bootstrap trees, averaged predictions */
  function mlRF(Xtr, ytr, nTrees, maxDepth, seed) {
    const rng = mlRand(seed);
    return Array.from({ length: nTrees }, () => {
      const n = Xtr.length; const bX = [], bY = [];
      for (let i = 0; i < n; i++) { const r = Math.floor(rng() * n); bX.push(Xtr[r]); bY.push(ytr[r]); }
      return mlBuildDT(bX, bY, 0, maxDepth);
    });
  }

  function mlPredRF(trees, x) { return trees.reduce((s, t) => s + mlPredDT(t, x), 0) / trees.length; }

  /** feature_importances_ via split-frequency across all trees */
  function mlImportances(trees, d) {
    const counts = Array(d).fill(0);
    function walk(n) { if (!n.leaf) { counts[n.fi]++; walk(n.left); walk(n.right); } }
    for (const t of trees) walk(t);
    const tot = counts.reduce((s, v) => s + v, 0) || 1;
    return counts.map(c => c / tot);
  }

  /** KMeans — Lloyd's algorithm, n_init restarts, pick lowest inertia */
  function mlKMeans(X, k, seed, nInit) {
    const rng = mlRand(seed);
    let best = null;
    for (let init = 0; init < nInit; init++) {
      const picked = new Set();
      while (picked.size < k) picked.add(Math.floor(rng() * X.length));
      let cents = [...picked].map(i => [...X[i]]);
      let labels = new Array(X.length).fill(0);
      for (let iter = 0; iter < 100; iter++) {
        const nl = X.map(p => { let bc = 0, bd = Infinity; cents.forEach((c, ci) => { const d = mlDist(p, c); if (d < bd) { bd = d; bc = ci; } }); return bc; });
        const conv = nl.every((l, i) => l === labels[i]);
        labels = nl;
        if (conv) break;
        const sums = Array.from({ length: k }, () => Array(X[0].length).fill(0)), cnts = Array(k).fill(0);
        X.forEach((p, i) => { p.forEach((v, d) => (sums[labels[i]][d] += v)); cnts[labels[i]]++; });
        cents = sums.map((s, ci) => s.map(v => cnts[ci] ? v / cnts[ci] : rng() * 2 - 1));
      }
      const inertia = X.reduce((s, p, i) => s + mlDist(p, cents[labels[i]]) ** 2, 0);
      if (!best || inertia < best.inertia) best = { labels: [...labels], cents: cents.map(c => [...c]), inertia };
    }
    return best;
  }

  /* ── KMeans Scatter SVG (200×200) ───────────────────────── */
  function KMeansScatter({ points, labels, cents, colors }) {
    const W = 200, H = 200, P = 16;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const xR = x1 - x0 || 1, yR = y1 - y0 || 1;
    const px = v => P + ((v - x0) / xR) * (W - 2 * P);
    const py = v => H - P - ((v - y0) / yR) * (H - 2 * P);
    const n = points.length;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="ml-scatter-svg" aria-label="K-Means cluster scatter plot">
        {points.map((p, i) => (
          <circle key={i} cx={px(p[0])} cy={py(p[1])}
            r={i === n - 1 ? 5.5 : 3}
            fill={colors[labels[i]]}
            opacity={i === n - 1 ? 1 : 0.5}
            stroke={i === n - 1 ? '#fff' : 'none'}
            strokeWidth={i === n - 1 ? 1.5 : 0} />
        ))}
        {cents.map((c, ci) => (
          <g key={`c${ci}`}>
            <circle cx={px(c[0])} cy={py(c[1])} r={9} fill="none" stroke={colors[ci]} strokeWidth={2} opacity={0.9} />
            <circle cx={px(c[0])} cy={py(c[1])} r={3} fill={colors[ci]} />
          </g>
        ))}
      </svg>
    );
  }

  /* ── MLInsightsSection ──────────────────────────────────── */
  function MLInsightsSection({ workoutLogs }) {
    const [results, setResults] = useState(null);
    const [running, setRunning] = useState(false);
    const MIN_LOGS = 10;
    const COLORS = ['#4ECDC4', '#E57399', '#c084fc'];

    const toFeats = (logs) => logs.map(log => {
      const sets = log.sets || [];
      const n = sets.length || 1;
      const avgReps = sets.reduce((s, x) => s + (Number(x.reps) || 0), 0) / n;
      const vol = sets.reduce((s, x) => s + (Number(x.reps) || 0) * (Number(x.weight) || 0), 0);
      const cal = Math.max(1, Math.round(vol * 0.04 + avgReps * n * 0.3 + 10));
      return { cal, dur: n * 2.5, sets: n, reps: Math.round(avgReps) };
    });

    const runModels = () => {
      setResults(null);
      setRunning(true);
      setTimeout(() => {
        try {
          const feats = toFeats(workoutLogs);

          /* ── Model 1: KNN Classifier ─────────────────────── */
          const knnLabel = f => f.cal < 200 ? 'Light' : f.cal <= 400 ? 'Moderate' : 'Intense';
          const knnX = feats.map(f => [f.cal, f.dur, f.sets, f.reps]);
          const knnY = feats.map(knnLabel);
          const kS = mlScale(knnX);
          const knnXs = kS.transform(knnX);
          const { Xtr: kTr, ytr: kYtr, Xte: kTe, yte: kYte } = mlSplit(knnXs, knnY, 0.3, 42);
          const kPreds = mlKNN(kTr, kYtr, kTe, 5);
          const kAcc = kPreds.filter((p, i) => p === kYte[i]).length / (kYte.length || 1);
          const latestKNN = mlKNN(kTr, kYtr, [kS.transform([knnX[knnX.length - 1]])[0]], 5)[0];

          /* ── Model 2: Random Forest Regressor ───────────── */
          const rfX = feats.map(f => [f.sets, f.reps, f.dur]);
          const rfY = feats.map(f => f.cal);
          const rS = mlScale(rfX);
          const rfXs = rS.transform(rfX);
          const { Xtr: rTr, ytr: rYtr, Xte: rTe, yte: rYte } = mlSplit(rfXs, rfY, 0.3, 42);
          const dtNode = mlBuildDT(rTr, rYtr, 0, 3);
          const dtPreds = rTe.map(x => mlPredDT(dtNode, x));
          const dtMSE = dtPreds.reduce((s, v, i) => s + (v - rYte[i]) ** 2, 0) / (rYte.length || 1);
          const rfTrees = mlRF(rTr, rYtr, 5, 3, 42);
          const rfPreds = rTe.map(x => mlPredRF(rfTrees, x));
          const rfMSE = rfPreds.reduce((s, v, i) => s + (v - rYte[i]) ** 2, 0) / (rYte.length || 1);
          const imp = mlImportances(rfTrees, 3);
          const latestRF = Math.max(0, Math.round(mlPredRF(rfTrees, rS.transform([rfX[rfX.length - 1]])[0])));

          /* ── Model 3: K-Means Clustering ────────────────── */
          const kmX = feats.map(f => [f.cal, f.dur]);
          const kmS = mlScale(kmX);
          const kmXs = kmS.transform(kmX);
          const km = mlKMeans(kmXs, 3, 42, 10);
          const sorted = [...km.cents.map((c, i) => ({ i, v: c[0] }))].sort((a, b) => a.v - b.v);
          const clusterNames = {};
          clusterNames[sorted[0].i] = 'Recovery';
          clusterNames[sorted[1].i] = 'Training';
          clusterNames[sorted[2].i] = 'Peak';
          const latestKM = clusterNames[km.labels[km.labels.length - 1]];

          // Cluster stats using original (unscaled) values
          const clusterStats = {};
          for (let ci = 0; ci < 3; ci++) {
            const members = kmX.filter((_, i) => km.labels[i] === ci);
            const count = members.length;
            const avgCal = count ? Math.round(members.reduce((s, p) => s + p[0], 0) / count) : 0;
            const avgDur = count ? +(members.reduce((s, p) => s + p[1], 0) / count).toFixed(1) : 0;
            clusterStats[ci] = { count, avgCal, avgDur, name: clusterNames[ci] };
          }

          setResults({
            knn: { acc: kAcc, pred: latestKNN },
            rf: { dtMSE, rfMSE, nextCal: latestRF, imp, featNames: ['Sets', 'Reps', 'Duration'] },
            km: { points: kmXs, labels: km.labels, cents: km.cents, clusterNames, clusterStats, latestCluster: latestKM },
          });
        } catch (err) {
          console.error('[ML] Error:', err);
        }
        setRunning(false);
      }, 80);
    };

    const intensityColor = { Light: '#4ECDC4', Moderate: '#A8E63D', Intense: '#F472B6' };

    if (!workoutLogs || workoutLogs.length < MIN_LOGS) {
      return (
        <div className="ml-section">
          <div className="ml-section-head">
            <h2 className="ml-section-title">AI Insights</h2>
            <p className="ml-section-sub">Models trained on your workout history</p>
          </div>
          <div className="chart-card ml-empty-card">
            <div className="ml-empty-icon">🤖</div>
            <p className="ml-empty-msg">Not enough data yet (need 10+ workouts)</p>
            <p className="ml-empty-hint">Keep logging workouts to unlock ML analysis</p>
          </div>
        </div>
      );
    }

    return (
      <div className="ml-section">
        <div className="ml-section-head">
          <div>
            <h2 className="ml-section-title">AI Insights</h2>
            <p className="ml-section-sub">Models trained on {workoutLogs.length} workout logs</p>
          </div>
          <button className="ml-run-btn" onClick={runModels} disabled={running}>
            {running ? <span className="ml-spinner" /> : '▶ Run Models'}
          </button>
        </div>

        {!results && !running && (
          <div className="chart-card ml-prompt-card">
            <span className="ml-prompt-icon">🧠</span>
            <span className="ml-prompt-text">Analyze {workoutLogs.length} workout logs with KNN · Random Forest · K-Means</span>
          </div>
        )}

        {results && (
          <div className="ml-cards">

            {/* ── KNN Card ──────────────────────────────────── */}
            <div className="chart-card ml-model-card">
              <div className="ml-card-top">
                <div>
                  <div className="ml-model-name">KNN Classifier</div>
                  <span className="ml-badge ml-badge-sup">Supervised</span>
                </div>
                <span className="ml-card-icon">🎯</span>
              </div>
              <div className="ml-features">Features: <b>calories · duration · sets · reps</b></div>
              <div className="ml-result-row">
                <div className="ml-result-label">Latest workout intensity</div>
                <div className="ml-result-val" style={{ color: intensityColor[results.knn.pred] }}>
                  {results.knn.pred}
                </div>
              </div>
              <div className="ml-metric-row">
                <span>Test accuracy (k=5)</span>
                <span className="ml-metric-val">{(results.knn.acc * 100).toFixed(1)}%</span>
              </div>
              <div className="ml-interp">
                Most recent workout classified as <b>{results.knn.pred}</b> intensity using 5 nearest neighbors on scaled features.
              </div>
            </div>

            {/* ── RF Card ───────────────────────────────────── */}
            <div className="chart-card ml-model-card">
              <div className="ml-card-top">
                <div>
                  <div className="ml-model-name">Random Forest</div>
                  <span className="ml-badge ml-badge-sup">Supervised</span>
                </div>
                <span className="ml-card-icon">🌲</span>
              </div>
              <div className="ml-features">Features: <b>sets · reps · duration</b></div>
              <div className="ml-result-row">
                <div className="ml-result-label">Predicted next workout</div>
                <div className="ml-result-val">{results.rf.nextCal} kcal</div>
              </div>
              <div className="ml-metric-row">
                <span>Model MSE (test set)</span>
                <span className="ml-metric-val">{results.rf.rfMSE.toFixed(1)}</span>
              </div>
              <div className="ml-interp">
                5 decision trees trained on bootstrap samples of your logs. Each tree votes and predictions are averaged — reducing the variance of any single tree. Your next workout is predicted to burn <b>~{results.rf.nextCal} kcal</b>.
              </div>
            </div>

            {/* ── K-Means Card ──────────────────────────────── */}
            <div className="chart-card ml-model-card ml-kmeans-card">
              <div className="ml-card-top">
                <div>
                  <div className="ml-model-name">K-Means Clustering</div>
                  <span className="ml-badge ml-badge-unsup">Unsupervised</span>
                </div>
                <span className="ml-card-icon">🔵</span>
              </div>
              <div className="ml-features">Features: <b>calories · duration</b></div>
              <div className="ml-result-row">
                <div className="ml-result-label">Latest workout cluster</div>
                <div className="ml-result-val" style={{ color: COLORS[Object.keys(results.km.clusterNames).find(k => results.km.clusterNames[k] === results.km.latestCluster)] }}>
                  {results.km.latestCluster}
                </div>
              </div>
              <div className="ml-km-body">
                <KMeansScatter points={results.km.points} labels={results.km.labels} cents={results.km.cents} colors={COLORS} />
                <div className="ml-km-cluster-table">
                  {Object.entries(results.km.clusterStats).map(([ci, s]) => (
                    <div key={ci} className="ml-km-cluster-row">
                      <span className="ml-cluster-dot" style={{ background: COLORS[ci] }} />
                      <span className="ml-km-cluster-name" style={{ color: COLORS[ci] }}>{s.name}</span>
                      <span className="ml-km-cluster-stat">{s.count} session{s.count !== 1 ? 's' : ''}</span>
                      <span className="ml-km-cluster-stat">~{s.avgCal} kcal</span>
                      <span className="ml-km-cluster-stat">{s.avgDur} min</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ml-interp">
                Your {results.km.labels.length} logged exercises were grouped into 3 clusters by the algorithm — no labels given, it found the structure on its own. <b>Recovery</b> = low-effort sets, <b>Training</b> = moderate volume, <b>Peak</b> = high-intensity. Your most recent session landed in <b>{results.km.latestCluster}</b>. Circles on the plot mark cluster centroids.
              </div>
            </div>

          </div>
        )}
      </div>
    );
  }

  /* ── TrackerPage (main) ──────────────────────────────────── */
  function TrackerPage({ profile }) {
    const [recentExercises, setRecentExercises] = useState([]);
    const [workoutLogs, setWorkoutLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dataVersion, setDataVersion] = useState(0);

    const loadAll = useCallback(async () => {
      const [trackerRes, statsRes] = await Promise.all([
        SpotMe.api.getTracker(90),
        SpotMe.api.getTrackerStats()
      ]);
      if (trackerRes.ok) {
        setRecentExercises(trackerRes.data.recentExercises || []);
        const flat = [];
        for (const day of Object.values(trackerRes.data.days || {})) flat.push(...day);
        setWorkoutLogs(flat);
      }
      if (statsRes.ok) {
        setStats(statsRes.data.stats);
      }
      if (trackerRes.ok || statsRes.ok) {
        setDataVersion((v) => v + 1);
      }
      setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    if (loading) {
      return (
        <div className="tracker-page">
          <div className="tracker-loading">
            <div className="tracker-loading-icon">🏋️</div>
            <div>Loading your workouts…</div>
          </div>
        </div>
      );
    }

    const firstName = profile?.firstName || profile?.first_name || profile?.name || '';

    const chartKey = String(dataVersion);

    return (
      <div className="tracker-page tracker-page--v2">
        <div className="tracker-content">
          <TrackerGreeting name={firstName} />

          {/* Top row: streak ring + activity pulse */}
          <div className="tracker-row tracker-row--two">
            <SpotMe.StreakCard
              streak={stats?.streak || 0}
              bestStreak={stats?.bestStreak || 0}
              key={`streak-${chartKey}`}
            />
            {stats?.weeklyActivity && (
              <SpotMe.WeeklyChart
                key={`wk-${chartKey}`}
                data={stats.weeklyActivity}
                trend={stats.trendPercent || 0}
              />
            )}
          </div>

          {/* Full-width dual-line trend */}
          {stats?.volumeHistory && (
            <SpotMe.TrendChart key={`vol-${chartKey}`} data={stats.volumeHistory} />
          )}

          {/* Bottom row: muscle rings + weekly goal */}
          <div className="tracker-row tracker-row--two">
            {stats?.muscleDistribution && (
              <SpotMe.MuscleChart
                key={`muscle-${chartKey}`}
                data={stats.muscleDistribution}
              />
            )}
            <VolumeGoalCard stats={stats} key={`goal-${chartKey}`} />
          </div>

          {stats?.prs && stats.prs.length > 0 && (
            <PRCard prs={stats.prs} onDeleted={loadAll} />
          )}

          {/* Smart suggestions */}
          <SmartSuggestions suggestions={stats?.suggestions} />

          {/* Quick add */}
          <QuickAddCard
            recentExercises={recentExercises}
            onLog={loadAll}
            weightUnit={profile?.weightUnit || 'kg'}
          />

          {/* ML Insights */}
          <MLInsightsSection workoutLogs={workoutLogs} />
        </div>
      </div>
    );
  }

  SpotMe.TrackerPage = TrackerPage;
})();
