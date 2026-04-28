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

  /* ── TrackerPage (main) ──────────────────────────────────── */
  function TrackerPage({ profile }) {
    const [recentExercises, setRecentExercises] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dataVersion, setDataVersion] = useState(0);

    const loadAll = useCallback(async () => {
      const [trackerRes, statsRes] = await Promise.all([
        SpotMe.api.getTracker(14),
        SpotMe.api.getTrackerStats()
      ]);
      if (trackerRes.ok) {
        setRecentExercises(trackerRes.data.recentExercises || []);
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
        </div>
      </div>
    );
  }

  SpotMe.TrackerPage = TrackerPage;
})();
