(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useMemo } = React;

  function MuscleChart({ data }) {
    const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

    // Don't render if no data
    if (!total) {
      return (
        <div className="chart-card muscle-chart-card is-empty">
          <h4 className="chart-title">Muscle Distribution</h4>
          <div className="chart-empty-state">Log workouts to see your split</div>
        </div>
      );
    }

    // Calculate paths for a simple donut
    let cumulativePercent = 0;
    const slices = data.slice(0, 5).map((d, i) => {
      const percent = d.value / total;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return { ...d, start, percent };
    });

    return (
      <div className="chart-card muscle-chart-card">
        <h4 className="chart-title">Muscle Distribution</h4>

        <div className="donut-layout">
          <div className="donut-svg-wrap">
            <svg viewBox="0 0 100 100" className="donut-svg">
              {slices.map((s, i) => {
                const dashArray = `${s.percent * 283} 283`;
                const dashOffset = `-${s.start * 283}`;
                return (
                  <circle
                    key={i}
                    cx="50" cy="50" r="45"
                    fill="transparent"
                    stroke={`var(--muscle-color-${i})`}
                    strokeWidth="10"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    className="donut-segment"
                  />
                );
              })}
              <circle cx="50" cy="50" r="35" fill="var(--card-bg-opaque)" />
            </svg>
            <div className="donut-center">
              <span className="donut-total">{total}</span>
              <span className="donut-label">Sets</span>
            </div>
          </div>

          <div className="donut-legend">
            {slices.map((s, i) => (
              <div key={i} className="legend-item">
                <div className="legend-dot" style={{ background: `var(--muscle-color-${i})` }} />
                <span className="legend-name">{s.name}</span>
                <span className="legend-val">{Math.round(s.percent * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  SpotMe.MuscleChart = MuscleChart;
})();
