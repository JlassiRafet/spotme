/* ============================================================
   SpotMe — CompletionPage
   Celebrates the end of a session run. Auto-redirects after 6s
   if the user does not act.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useEffect, useMemo, useRef } = React;
  const { CheckBigIcon, ClockIcon, FlameIcon, HeartIcon } = SpotMe.icons;

  function fmtMins(seconds) {
    const m = Math.round(seconds / 60);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }

  function ConfettiBurst() {
    const colors = ['#2dd4bf', '#34d399', '#c6e860', '#ff9b3d', '#fb923c'];
    const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
      left: Math.round(Math.random() * 100),
      delay: Math.round(Math.random() * 600),
      color: colors[i % colors.length],
      tilt: Math.round(Math.random() * 360)
    })), []);
    return (
      <div className="fit-completion-confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="fit-confetti-piece"
            style={{
              left: `${p.left}%`,
              background: p.color,
              transform: `rotate(${p.tilt}deg)`,
              animationDelay: `${p.delay}ms`
            }}
          />
        ))}
      </div>
    );
  }

  function CompletionPage({ profile, route, onNavigate }) {
    const idleTimer = useRef(null);

    useEffect(() => {
      idleTimer.current = setTimeout(() => onNavigate('home'), 6000);
      return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
    }, [onNavigate]);

    const firstName = profile?.firstName || 'Athlete';
    const duration = route?.duration || 0;
    const calories = route?.calories || 0;
    const bpm = route?.avgBpm || 102;

    return (
      <div className="fit-page">
        <div className="fit-completion">
          <ConfettiBurst />

          <div className="fit-completion-circle" aria-hidden="true">
            <span style={{ width: 56, height: 56, display: 'inline-flex' }}>
              <CheckBigIcon />
            </span>
          </div>

          <h1 className="fit-completion-title">Good Job, {firstName}</h1>
          <p className="fit-completion-sub">
            Your activity is over. Keep improving your training skills.
          </p>

          <div className="fit-completion-chips">
            <span className="fit-completion-chip is-time">
              <span style={{ width: 14, height: 14, display: 'inline-flex' }}><ClockIcon /></span>
              {fmtMins(duration)}
            </span>
            <span className="fit-completion-chip is-flame">
              <span style={{ width: 14, height: 14, display: 'inline-flex' }}><FlameIcon /></span>
              {calories} kcal
            </span>
            <span className="fit-completion-chip is-heart">
              <span style={{ width: 14, height: 14, display: 'inline-flex' }}><HeartIcon /></span>
              {bpm} bpm
            </span>
          </div>

          <button
            type="button"
            className="fit-completion-cta"
            onClick={() => onNavigate('home')}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  SpotMe.CompletionPage = CompletionPage;
})();
