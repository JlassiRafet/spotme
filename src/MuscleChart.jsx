(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useMemo } = React;

  /* Concentric multi-ring "Progress" card — teal · pink rose · violet rings.
     Legend: emoji + percentage. */
  const RING_COLORS = ['#4ECDC4', '#E57399', '#A855F7'];
  const MUSCLE_EMOJI = {
    chest: '🫁', back: '🔙', legs: '🦵',
    shoulders: '💪', arms: '💪', core: '🎯',
  };

  function emojiFor(name) {
    const k = String(name || '').toLowerCase();
    return MUSCLE_EMOJI[k] || '⚡';
  }

  function MuscleChart({ data }) {
    const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

    if (!total) {
      return (
        <div className="chart-card progress-card is-empty">
          <h4 className="chart-title">Progress</h4>
          <div className="chart-empty-state">Log workouts to see your split</div>
        </div>
      );
    }

    const top = data.slice(0, 3).map((d, i) => ({
      ...d,
      ratio: d.value / total,
      color: RING_COLORS[i],
    }));

    const RINGS = [
      { r: 42, w: 8 },
      { r: 30, w: 8 },
      { r: 18, w: 8 },
    ];

    return (
      <div className="chart-card progress-card">
        <h4 className="chart-title">Progress</h4>

        <div className="progress-card-body">
          <svg viewBox="0 0 100 100" className="progress-rings-svg" aria-hidden="true">
            {top.map((s, i) => {
              const ring = RINGS[i];
              if (!ring) return null;
              const C = 2 * Math.PI * ring.r;
              const dash = s.ratio * C;
              return (
                <g key={i}>
                  <circle cx="50" cy="50" r={ring.r}
                          fill="transparent"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth={ring.w} />
                  <circle cx="50" cy="50" r={ring.r}
                          fill="transparent"
                          stroke={s.color}
                          strokeWidth={ring.w}
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${C}`}
                          transform="rotate(-90 50 50)"
                          className="progress-ring-arc"
                          style={{ animationDelay: `${i * 120}ms` }} />
                </g>
              );
            })}
          </svg>

          <div className="progress-legend">
            {top.map((s, i) => (
              <div key={i} className="progress-legend-item">
                <span className="progress-legend-emoji">{emojiFor(s.name)}</span>
                <span className="progress-legend-pct" style={{ color: s.color }}>
                  {Math.round(s.ratio * 100)}%
                </span>
                <span className="progress-legend-name">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  SpotMe.MuscleChart = MuscleChart;
})();
