(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  function StreakCard({ streak, bestStreak }) {
    const isActive = streak > 0;
    const progress = Math.min((streak / (bestStreak || 1)) * 100, 100);

    return (
      <div className={`tracker-streak-card upgraded ${isActive ? 'is-active' : ''}`}>
        <div className="streak-visual">
          <div className="flame-container">
            <span className={`flame-emoji ${isActive ? 'is-animated' : ''}`}>🔥</span>
            {isActive && <div className="flame-glow" />}
          </div>
          <div className="streak-main">
            <div className="streak-count">{streak}</div>
            <div className="streak-label">Day Streak</div>
          </div>
        </div>

        <div className="streak-progress-wrap">
          <div className="streak-progress-header">
            <span>Progress to Personal Best</span>
            <span>{bestStreak}d</span>
          </div>
          <div className="streak-progress-bar">
            <div className="streak-progress-fill" style={{ width: `${progress}%` }}>
              <div className="streak-progress-glow" />
            </div>
          </div>
          {streak >= bestStreak && streak > 0 && (
            <div className="streak-milestone">⭐ NEW PERSONAL BEST!</div>
          )}
        </div>
      </div>
    );
  }

  SpotMe.StreakCard = StreakCard;
})();
