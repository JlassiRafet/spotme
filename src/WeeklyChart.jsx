(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useMemo } = React;

  /* Heart-rate-pulse style bar chart. Image 1 "Heart rate" card.
     Tall narrow pill bars; today glows pink. Subtitle reads like "X bpm". */
  function WeeklyChart({ data, trend }) {
    const maxVal = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
    const isUp = trend >= 0;
    const totalThisWeek = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);

    return (
      <div className="chart-card pulse-card">
        <div className="chart-header">
          <div className="chart-title-wrap">
            <h4 className="chart-title">Activity</h4>
            <div className={`trend-badge ${isUp ? 'is-up' : 'is-down'}`}>
              {isUp ? '↑' : '↓'} {Math.abs(trend)}%
            </div>
          </div>
          <div className="pulse-card-readout">
            <span className="pulse-card-num">{totalThisWeek}</span>
            <span className="pulse-card-unit">workouts</span>
          </div>
        </div>

        <div className="pulse-bars">
          {data.map((d, i) => {
            const heightPct = Math.max((d.count / (maxVal * 1.15)) * 100, d.count > 0 ? 18 : 8);
            const empty = d.count === 0;
            return (
              <div key={i} className={`pulse-col ${d.isToday ? 'is-today' : ''} ${empty ? 'is-empty' : ''}`}>
                <div className="pulse-bar-track">
                  <div
                    className="pulse-bar-fill"
                    style={{ height: `${heightPct}%`, animationDelay: `${i * 70}ms` }}
                  />
                </div>
                <span className="pulse-day">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  SpotMe.WeeklyChart = WeeklyChart;
})();
