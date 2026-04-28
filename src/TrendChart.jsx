(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useMemo } = React;

  function TrendChart({ data }) {
    const maxVal = useMemo(() => Math.max(...data.map(d => d.volume), 1), [data]);

    // Build SVG path for line
    const points = useMemo(() => {
      const width = 300;
      const height = 100;
      const step = width / (data.length - 1);
      return data.map((d, i) => {
        const x = i * step;
        const y = height - (d.volume / (maxVal * 1.1)) * height;
        return `${x},${y}`;
      }).join(' ');
    }, [data, maxVal]);

    const areaPoints = useMemo(() => {
      if (!points) return '';
      return `0,100 ${points} 300,100`;
    }, [points]);

    return (
      <div className="chart-card trend-chart-card">
        <h4 className="chart-title">Workout Volume (30d)</h4>
        <div className="line-chart-container">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="line-svg">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255, 136, 68, 0.3)" />
                <stop offset="100%" stopColor="rgba(255, 136, 68, 0)" />
              </linearGradient>
            </defs>
            <polyline
              points={areaPoints}
              fill="url(#areaGradient)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#ff8844"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="trend-line"
            />
          </svg>
        </div>
        <div className="chart-footer">
          <span className="footer-label">30 days ago</span>
          <span className="footer-label">Today</span>
        </div>
      </div>
    );
  }

  SpotMe.TrendChart = TrendChart;
})();
