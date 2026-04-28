/* ============================================================
   SpotMe — ProgramDetailPage + SessionRunner + DietRunner
   Detail: full-bleed hero + Start CTA + stat tiles + session list.
   SessionRunner: minimal full-screen workout timer.
   DietRunner: day-by-day tip browser for diet/macro programs.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef, useCallback } = React;
  const {
    ArrowLeftIcon, ArrowRightIcon, FlameIcon, ClockIcon,
    PlayIcon, PauseIcon, CheckBigIcon
  } = SpotMe.icons;

  /* ---------- Detail screen ---------- */
  function ProgramDetailPage({ profile, route, onNavigate, onBack }) {
    const programId = route?.programId;
    const [program, setProgram] = useState(null);
    const [error, setError] = useState(null);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
      if (!programId) return;
      let cancelled = false;
      setProgram(null);
      setError(null);
      SpotMe.api.getProgram(programId).then(r => {
        if (cancelled) return;
        if (r.ok) setProgram(r.data.program);
        else setError(r.error || 'Could not load program.');
      });
      return () => { cancelled = true; };
    }, [programId]);

    const start = async () => {
      if (!program || starting) return;
      setStarting(true);
      const r = await SpotMe.api.startProgram(program.id);
      setStarting(false);
      if (!r.ok) { setError(r.error); return; }
      const isDiet = program.category?.toLowerCase() === 'diet';
      onNavigate(isDiet ? 'dietRunner' : 'runner', {
        programId: program.id,
        runId: r.data.runId,
        program,
        from: route?.from || { name: 'home' }
      });
    };

    if (!programId) {
      return (
        <div className="fit-page" style={{ paddingTop: 80 }}>
          <div className="fit-empty">
            <div className="fit-empty-title">No program selected</div>
            <button
              type="button"
              className="fit-completion-cta"
              style={{ marginTop: 16 }}
              onClick={onBack}
            >Back</button>
          </div>
        </div>
      );
    }

    if (!program && !error) {
      return (
        <div className="fit-page" style={{ paddingTop: 80 }}>
          <div className="fit-loading"><span className="fit-spinner" />Loading program…</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="fit-page" style={{ paddingTop: 80 }}>
          <div className="fit-empty">
            <div className="fit-empty-title">Could not load program</div>
            <div>{error}</div>
            <button
              type="button"
              className="fit-completion-cta"
              style={{ marginTop: 16 }}
              onClick={onBack}
            >Back</button>
          </div>
        </div>
      );
    }

    const isDiet = program.category?.toLowerCase() === 'diet';
    const sessions = program.sessions || [];

    return (
      <div className="fit-detail">
        <div className="fit-page">
          <div className="fit-detail-hero">
            <button
              type="button"
              className="fit-detail-hero-back"
              onClick={onBack}
              aria-label="Back"
            >
              <span style={{ width: 18, height: 18, display: 'inline-flex' }}><ArrowLeftIcon /></span>
            </button>
            {program.heroImage && (
              <img src={program.heroImage} alt="" className="fit-detail-hero-img" />
            )}
            <div className="fit-detail-hero-grad" />
            <div className="fit-detail-hero-content">
              <span className="fit-detail-hero-tag">{program.category}</span>
              <div className="fit-detail-hero-title">{program.name}</div>
              <button
                type="button"
                className="fit-detail-start-btn"
                onClick={start}
                disabled={starting}
              >
                {starting ? 'Starting…' : isDiet ? 'Start Tracking' : 'Start Program'}
                <span style={{ width: 14, height: 14, display: 'inline-flex' }}><ArrowRightIcon /></span>
              </button>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="fit-detail-stats">
            {isDiet ? (
              <>
                <div className="fit-metric-tile">
                  <div className="fit-metric-tile-head">
                    <span className="fit-metric-name">Days</span>
                    <span className="fit-metric-icon">
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}><ClockIcon /></span>
                    </span>
                  </div>
                  <div className="fit-metric-value t-mono-num">{sessions.length || 0}</div>
                  <div className="fit-metric-unit">in plan</div>
                </div>
                <div className="fit-metric-tile">
                  <div className="fit-metric-tile-head">
                    <span className="fit-metric-name">Meals / Day</span>
                    <span className="fit-metric-icon is-flame">
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}><FlameIcon /></span>
                    </span>
                  </div>
                  <div className="fit-metric-value t-mono-num">
                    {sessions[0]?.sets || 3}
                  </div>
                  <div className="fit-metric-unit">meals</div>
                </div>
              </>
            ) : (
              <>
                <div className="fit-metric-tile">
                  <div className="fit-metric-tile-head">
                    <span className="fit-metric-name">Calories</span>
                    <span className="fit-metric-icon is-flame">
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}><FlameIcon /></span>
                    </span>
                  </div>
                  <div className="fit-metric-value t-mono-num">{program.totalCalories ?? 0}</div>
                  <div className="fit-metric-unit">kcal</div>
                </div>
                <div className="fit-metric-tile">
                  <div className="fit-metric-tile-head">
                    <span className="fit-metric-name">Duration</span>
                    <span className="fit-metric-icon">
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}><ClockIcon /></span>
                    </span>
                  </div>
                  <div className="fit-metric-value t-mono-num">{program.totalMinutes ?? 0}</div>
                  <div className="fit-metric-unit">Minutes</div>
                </div>
              </>
            )}
          </div>

          <h2 className="fit-detail-program-label">{isDiet ? 'Your Plan' : 'Program'}</h2>

          <div className="fit-session-list">
            {sessions.map(s => (
              <button
                key={s.id}
                type="button"
                className="fit-session-item"
                onClick={start}
                aria-label={`Start ${s.name}`}
              >
                <div
                  className="fit-session-thumb"
                  style={s.thumbnail ? { backgroundImage: `url(${s.thumbnail})` } : undefined}
                />
                <div className="fit-session-info">
                  <div className="fit-session-cat">{program.category}</div>
                  <div className="fit-session-name">{s.name}</div>
                  <div className="fit-session-detail">
                    {isDiet
                      ? (s.tips || 'Tap to view tips')
                      : [
                          s.sets ? `Set ${s.sets}` : '',
                          s.sets && s.reps ? ' · ' : '',
                          s.reps ? `${s.reps} Reps` : '',
                          (s.minutes && (s.sets || s.reps)) ? ' · ' : '',
                          s.minutes ? `${s.minutes} min` : ''
                        ].join('')
                    }
                  </div>
                </div>
                <span className="fit-session-arrow">
                  <span style={{ width: 18, height: 18, display: 'inline-flex' }}><ArrowRightIcon /></span>
                </span>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="fit-empty">No sessions in this program yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Session runner (workout) ---------- */
  function SessionRunner({ profile, route, onNavigate, onBack }) {
    const program = route?.program;
    const runId = route?.runId;
    const [running, setRunning] = useState(true);
    const [seconds, setSeconds] = useState(0);
    const [stepIdx, setStepIdx] = useState(0);
    const [finishing, setFinishing] = useState(false);

    const totalSeconds = (program?.totalMinutes || 1) * 60;
    const sessions = program?.sessions || [];
    const current = sessions[stepIdx] || sessions[0] || { name: 'Workout', sets: 0, reps: 0 };

    useEffect(() => {
      if (!running) return;
      const tid = setInterval(() => setSeconds(s => s + 1), 1000);
      return () => clearInterval(tid);
    }, [running]);

    const fmt = useCallback((s) => {
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const ss = (s % 60).toString().padStart(2, '0');
      return `${m}:${ss}`;
    }, []);

    const finish = async () => {
      if (!program || !runId || finishing) return;
      setFinishing(true);
      const calories = Math.round((program.totalCalories || 0) * Math.min(1, seconds / totalSeconds));
      const r = await SpotMe.api.finishProgram(program.id, {
        runId,
        calories,
        durationSeconds: seconds,
        avgBpm: 102
      });
      setFinishing(false);
      if (r.ok) {
        const cat = String(program.category || '').toLowerCase();
        let muscleGroup = '';
        if (cat.includes('muscle') || cat.includes('strength')) muscleGroup = 'Chest';
        else if (cat.includes('cardio')) muscleGroup = 'Legs';
        else if (cat.includes('diet')) muscleGroup = 'Core';
        SpotMe.api.logWorkout({
          exercise: `${program.name} — session`,
          sets: [{ reps: 1, weight: 0 }],
          muscleGroup,
          source: 'program'
        }).catch(() => {});
        onNavigate('completion', {
          runId,
          program,
          duration: seconds,
          calories,
          avgBpm: 102
        });
      }
    };

    const exit = () => {
      if (!confirm('Exit workout? Your progress will not be saved.')) return;
      onBack();
    };

    if (!program) {
      return (
        <div className="fit-page" style={{ paddingTop: 80 }}>
          <div className="fit-empty">
            <div className="fit-empty-title">Workout session not found</div>
            <button type="button" className="fit-completion-cta" onClick={onBack}>Back</button>
          </div>
        </div>
      );
    }

    const pct = Math.min(100, (seconds / totalSeconds) * 100);

    return (
      <div className="fit-page">
        <div className="fit-runner">
          <button type="button" className="fit-runner-exit" onClick={exit}>
            <span style={{ width: 14, height: 14, display: 'inline-flex' }}><ArrowLeftIcon /></span>
            Exit
          </button>

          <div className="fit-runner-progress">
            <div className="fit-runner-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="fit-runner-stage">
            <div className="fit-runner-step">
              Step {stepIdx + 1} / {Math.max(1, sessions.length)}
            </div>
            <div className="fit-runner-name">{current.name}</div>
            <div className="fit-runner-detail">
              {current.sets ? `${current.sets} sets · ` : ''}
              {current.reps ? `${current.reps} reps` : ''}
              {!current.sets && !current.reps && current.minutes ? `${current.minutes} min` : ''}
            </div>
            <div className="fit-runner-timer t-mono-num">{fmt(seconds)}</div>

            <div className="fit-runner-actions">
              <button
                type="button"
                className="fit-runner-btn fit-runner-btn-ghost"
                onClick={() => setRunning(r => !r)}
              >
                <span style={{ width: 14, height: 14, display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}>
                  {running ? <PauseIcon /> : <PlayIcon />}
                </span>
                {running ? 'Pause' : 'Resume'}
              </button>
              {stepIdx < sessions.length - 1 ? (
                <button
                  type="button"
                  className="fit-runner-btn fit-runner-btn-primary"
                  onClick={() => setStepIdx(i => i + 1)}
                >
                  Next step
                </button>
              ) : (
                <button
                  type="button"
                  className="fit-runner-btn fit-runner-btn-primary"
                  onClick={finish}
                  disabled={finishing}
                >
                  <span style={{ width: 14, height: 14, display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}>
                    <CheckBigIcon />
                  </span>
                  {finishing ? 'Saving…' : 'Finish'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Diet runner (day-by-day tip browser) ---------- */
  function DietRunner({ profile, route, onNavigate, onBack }) {
    const program = route?.program;
    const runId = route?.runId;
    const sessions = program?.sessions || [];
    const [dayIdx, setDayIdx] = useState(0);
    const [finishing, setFinishing] = useState(false);

    const current = sessions[dayIdx] || { name: 'Day 1', tips: '' };
    const isLast = dayIdx === sessions.length - 1;

    const finish = async () => {
      if (!program || !runId || finishing) return;
      setFinishing(true);
      const r = await SpotMe.api.finishProgram(program.id, {
        runId,
        calories: 0,
        durationSeconds: 0,
        avgBpm: null
      });
      setFinishing(false);
      if (r.ok) {
        onNavigate('completion', {
          runId,
          program,
          duration: 0,
          calories: 0,
          avgBpm: null
        });
      }
    };

    const exit = () => {
      if (!confirm('Exit plan? Your progress will not be saved.')) return;
      onBack();
    };

    if (!program) {
      return (
        <div className="fit-page" style={{ paddingTop: 80 }}>
          <div className="fit-empty">
            <div className="fit-empty-title">Plan not found</div>
            <button type="button" className="fit-completion-cta" onClick={onBack}>Back</button>
          </div>
        </div>
      );
    }

    const pct = sessions.length > 1 ? Math.round(((dayIdx + 1) / sessions.length) * 100) : 100;

    return (
      <div className="fit-page">
        <div className="fit-diet-runner">
          <button type="button" className="fit-runner-exit" onClick={exit}>
            <span style={{ width: 14, height: 14, display: 'inline-flex' }}><ArrowLeftIcon /></span>
            Exit
          </button>

          <div className="fit-runner-progress">
            <div className="fit-runner-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="fit-diet-runner-header">
            <div className="fit-diet-runner-program">{program.name}</div>
            <div className="fit-diet-runner-day">
              Day {dayIdx + 1} <span className="fit-diet-runner-day-total">/ {sessions.length}</span>
            </div>
          </div>

          <div className="fit-diet-runner-card">
            <div className="fit-diet-runner-title">{current.name}</div>
            {current.tips ? (
              <p className="fit-diet-tip">{current.tips}</p>
            ) : (
              <p className="fit-diet-tip fit-diet-tip-empty">
                No tips recorded for this day yet. Keep following your macro targets and stay consistent!
              </p>
            )}
          </div>

          <div className="fit-diet-day-nav">
            <button
              type="button"
              className="fit-runner-btn fit-runner-btn-ghost"
              onClick={() => setDayIdx(i => Math.max(0, i - 1))}
              disabled={dayIdx === 0}
            >
              <span style={{ width: 14, height: 14, display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}>
                <ArrowLeftIcon />
              </span>
              Prev day
            </button>

            {isLast ? (
              <button
                type="button"
                className="fit-runner-btn fit-runner-btn-primary"
                onClick={finish}
                disabled={finishing}
              >
                <span style={{ width: 14, height: 14, display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}>
                  <CheckBigIcon />
                </span>
                {finishing ? 'Saving…' : 'Mark complete'}
              </button>
            ) : (
              <button
                type="button"
                className="fit-runner-btn fit-runner-btn-primary"
                onClick={() => setDayIdx(i => Math.min(sessions.length - 1, i + 1))}
              >
                Next day
                <span style={{ width: 14, height: 14, display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}>
                  <ArrowRightIcon />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  SpotMe.ProgramDetailPage = ProgramDetailPage;
  SpotMe.SessionRunner = SessionRunner;
  SpotMe.DietRunner = DietRunner;
})();
