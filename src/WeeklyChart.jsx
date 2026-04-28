(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useMemo } = React;

  function WeeklyChart({ data, trend }) {
    const maxVal = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
    const isUp = trend >= 0;

    return (
      <div className="chart-card weekly-activity-card">
        <div className="chart-header">
          <div className="chart-title-wrap">
            <h4 className="chart-title">Weekly Activity</h4>
            <div className={`trend-badge ${isUp ? 'is-up' : 'is-down'}`}>
              {isUp ? '↑' : '↓'} {Math.abs(trend)}%
            </div>
          </div>
          <span className="chart-subtitle">vs last week</span>
        </div>

        <div className="bar-chart-container">
          {data.map((d, i) => {
            const heightPct = (d.count / (maxVal * 1.2)) * 100;
            return (
              <div key={i} className={`bar-column ${d.isToday ? 'is-today' : ''}`}>
                <div className="bar-value-label">{d.count > 0 ? d.count : ''}</div>
                <div className="bar-wrapper">
                  <div className="bar-fill" style={{ height: `${heightPct}%` }}>
                    <div className="bar-glow" />
                  </div>
                </div>
                <div className="bar-label">{d.day}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  SpotMe.WeeklyChart = WeeklyChart;
})();
