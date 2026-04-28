/* ============================================================
   SpotMe — TrackerPage
   Workout Memory + Progress Engine. Contains:
     • StreakCard      — daily streak with fire animation
     • StatsCard       — weekly summary + PRs
     • QuickAddCard    — zero-friction workout logger
     • TrackerTimeline — daily-grouped workout history
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

  /* ── Date helpers ─────────────────────────────────────────── */
  function friendlyDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = (now - d) / 86400000;
    if (diff < 1 && diff >= 0) return 'Today';
    if (diff >= 1 && diff < 2) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatSets(sets) {
    if (!sets || !sets.length) return '—';
    if (sets.length === 1) {
      const s = sets[0];
      if (s.weight > 0) return `${s.reps} reps × ${s.weight}kg`;
      return `${s.reps} reps`;
    }
    const hasWeight = sets.some(s => s.weight > 0);
    if (hasWeight) {
      return sets.map(s => `${s.reps}×${s.weight}kg`).join(', ');
    }
    return sets.map(s => s.reps).join(', ') + ' reps';
  }

  /* ── Personal Records Card ───────────────────────────────── */
  function PRCard({ prs }) {
    if (!prs || prs.length === 0) return null;
    return (
      <div className="chart-card prs-card">
        <h4 className="chart-title">Personal Records</h4>
        <div className="prs-grid">
          {prs.map((pr, i) => (
            <div key={i} className="pr-card">
              <div className="pr-info">
                <span className="pr-name">{pr.exercise}</span>
                <span className="pr-date">{new Date(pr.date * 1000).toLocaleDateString()}</span>
              </div>
              <div className="pr-stats">
                <div className="pr-weight">{pr.weight}kg</div>
                <div className="pr-delta">↑ New Peak</div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
      if (!exercise.trim() || !recentExercises) return recentExercises || [];
      const q = exercise.toLowerCase();
      return recentExercises.filter(r => r.exercise.toLowerCase().includes(q));
    }, [exercise, recentExercises]);

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
        setTimeout(() => {
          setExercise('');
          setMuscleGroup('');
          setSets([{ reps: '', weight: '' }]);
          setSaved(false);
          setExpanded(false);
          onLog();
        }, 800);
      }
    };

    return (
      <div className={`tracker-quick-add${saved ? ' is-saved' : ''}`}>
        <div className="quick-add-header">
          <h3 className="quick-add-title">Log Workout</h3>
          {saved && <span className="quick-add-check">✓ Saved</span>}
        </div>

        {/* Exercise name */}
        <div className="quick-add-exercise-wrap">
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
          {showSuggestions && filtered.length > 0 && (
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

  /* ── ExerciseCard (single workout entry in timeline) ──────── */
  function ExerciseCard({ workout, onDelete }) {
    const [confirming, setConfirming] = useState(false);

    const handleDelete = async () => {
      if (!confirming) { setConfirming(true); return; }
      await SpotMe.api.deleteWorkoutLog(workout.id);
      onDelete();
    };

    const sourceIcon = workout.source === 'identify' ? '📷'
                     : workout.source === 'chat'     ? '💬'
                     : null;

    return (
      <div className="exercise-card">
        <div className="exercise-card-main">
          <div className="exercise-card-name">
            {sourceIcon && <span className="exercise-source-icon">{sourceIcon}</span>}
            {workout.exercise}
          </div>
          <div className="exercise-card-detail">
            {formatSets(workout.sets)}
          </div>
          {workout.muscleGroup && (
            <span className="exercise-card-muscle">{workout.muscleGroup}</span>
          )}
        </div>
        <button type="button"
                className={`exercise-delete-btn${confirming ? ' is-confirming' : ''}`}
                onClick={handleDelete}
                onBlur={() => setConfirming(false)}
                aria-label="Delete workout">
          {confirming ? '✓' : '×'}
        </button>
      </div>
    );
  }

  /* ── TrackerTimeline ──────────────────────────────────────── */
  function TrackerTimeline({ days, onRefresh }) {
    const sortedDays = useMemo(() => {
      if (!days) return [];
      return Object.entries(days)
        .sort((a, b) => b[0].localeCompare(a[0]));
    }, [days]);

    if (sortedDays.length === 0) {
      return (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">🏋️</div>
          <div className="timeline-empty-title">No workouts yet</div>
          <div className="timeline-empty-text">
            Log your first exercise above to start tracking your progress!
          </div>
        </div>
      );
    }

    return (
      <div className="tracker-timeline">
        <h3 className="timeline-title">Recent Activity</h3>
        {sortedDays.map(([date, workouts]) => (
          <div key={date} className="timeline-day">
            <div className="timeline-day-header">
              <span className="timeline-day-label">{friendlyDay(date)}</span>
              <span className="timeline-day-count">
                {workouts.length} exercise{workouts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="timeline-day-cards">
              {workouts.map(w => (
                <ExerciseCard key={w.id} workout={w} onDelete={onRefresh} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── TrackerPage (main) ──────────────────────────────────── */
  function TrackerPage({ profile }) {
    const [days, setDays] = useState(null);
    const [recentExercises, setRecentExercises] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadAll = useCallback(async () => {
      const [trackerRes, statsRes] = await Promise.all([
        SpotMe.api.getTracker(14),
        SpotMe.api.getTrackerStats()
      ]);
      if (trackerRes.ok) {
        setDays(trackerRes.data.days);
        setRecentExercises(trackerRes.data.recentExercises || []);
      }
      if (statsRes.ok) {
        setStats(statsRes.data.stats);
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

    return (
      <div className="tracker-page">
        <div className="tracker-content">
          {/* Dashboard Grid */}
          <div className="tracker-dashboard-grid">
            <div className="grid-full">
              <SpotMe.StreakCard
                streak={stats?.streak || 0}
                bestStreak={stats?.bestStreak || 0}
              />
            </div>

            {stats?.weeklyActivity && (
              <SpotMe.WeeklyChart
                data={stats.weeklyActivity}
                trend={stats.trendPercent || 0}
              />
            )}

            {stats?.muscleDistribution && (
              <SpotMe.MuscleChart
                data={stats.muscleDistribution}
              />
            )}

            {stats?.volumeHistory && (
              <div className="grid-full">
                <SpotMe.TrendChart
                  data={stats.volumeHistory}
                />
              </div>
            )}

            {stats?.prs && (
              <div className="grid-full">
                <PRCard prs={stats.prs} />
              </div>
            )}
          </div>

          {/* Smart suggestions */}
          <SmartSuggestions suggestions={stats?.suggestions} />

          {/* Quick add */}
          <QuickAddCard
            recentExercises={recentExercises}
            onLog={loadAll}
            weightUnit={profile?.weightUnit || 'kg'}
          />

          {/* Timeline */}
          <TrackerTimeline days={days} onRefresh={loadAll} />
        </div>
      </div>
    );
  }

  SpotMe.TrackerPage = TrackerPage;
})();
