(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  /* Circular streak ring. Image 1 "Steps" card → SpotMe streak card.
     Ring fills toward best streak; teal gradient stroke. */
  function StreakCard({ streak, bestStreak }) {
    const isActive = streak > 0;
    const target = Math.max(bestStreak || 0, 1);
    const ratio = Math.max(0, Math.min(streak / target, 1));

    const R = 44;
    const C = 2 * Math.PI * R;
    const dash = ratio * C;

    return (
      <div className={`tracker-ring-card streak-ring-card ${isActive ? 'is-active' : ''}`}>
        <div className="ring-card-header">
          <span className="ring-card-title">Streak</span>
          {isActive && <span className="ring-card-badge">🔥</span>}
        </div>

        <div className="ring-card-visual">
          <svg viewBox="0 0 100 100" className="streak-ring-svg" aria-hidden="true">
            <defs>
              <linearGradient id="streakRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"  stopColor="#4ECDC4" />
                <stop offset="100%" stopColor="#A8E63D" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={R}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8" />
            <circle cx="50" cy="50" r={R}
                    fill="transparent"
                    stroke="url(#streakRingGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${C}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 50 50)"
                    className="streak-ring-progress" />
          </svg>

          <div className="ring-card-center">
            <div className="ring-card-value">{streak}</div>
            <div className="ring-card-unit">days</div>
          </div>
        </div>

        <div className="ring-card-meta">
          <span>Best</span>
          <strong>{bestStreak}d</strong>
        </div>
      </div>
    );
  }

  SpotMe.StreakCard = StreakCard;
})();
