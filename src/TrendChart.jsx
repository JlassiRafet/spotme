(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useMemo } = React;

  /* Dual-line chart à la Image 1 "Today vs Average" card.
     - Solid teal line: actual daily volume
     - Dashed line: rolling 7-day average
     - Latest data point gets a glowing dot */
  function smoothPoints(values, w, h, padX = 4, padY = 8) {
    if (!values.length) return '';
    const max = Math.max(...values, 1);
    const stepX = (w - padX * 2) / Math.max(values.length - 1, 1);
    return values.map((v, i) => {
      const x = padX + i * stepX;
      const y = h - padY - (v / (max * 1.1)) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  function rollingAvg(values, window = 7) {
    return values.map((_, i) => {
      const slice = values.slice(Math.max(0, i - window + 1), i + 1);
      const sum = slice.reduce((s, v) => s + v, 0);
      return sum / slice.length;
    });
  }

  function TrendChart({ data }) {
    const W = 320;
    const H = 120;

    const series = useMemo(() => data.map(d => Number(d.volume) || 0), [data]);
    const avgSeries = useMemo(() => rollingAvg(series), [series]);

    const todayVal = series[series.length - 1] || 0;
    const avgVal = Math.round(avgSeries[avgSeries.length - 1] || 0);

    const dataPath = useMemo(() => smoothPoints(series, W, H), [series]);
    const avgPath = useMemo(() => smoothPoints(avgSeries, W, H), [avgSeries]);

    const lastPoint = useMemo(() => {
      const max = Math.max(...series, 1);
      const padX = 4, padY = 8;
      const stepX = (W - padX * 2) / Math.max(series.length - 1, 1);
      const x = padX + (series.length - 1) * stepX;
      const y = H - padY - (todayVal / (max * 1.1)) * (H - padY * 2);
      return { x, y };
    }, [series, todayVal]);

    return (
      <div className="chart-card dual-line-card">
        <div className="dual-line-header">
          <div className="dual-line-stat">
            <span className="dual-line-dot today" />
            <span className="dual-line-label">Today</span>
            <span className="dual-line-value">{Math.round(todayVal)} <em>vol</em></span>
          </div>
          <div className="dual-line-stat">
            <span className="dual-line-dot avg" />
            <span className="dual-line-label">Average</span>
            <span className="dual-line-value">{avgVal} <em>vol</em></span>
          </div>
        </div>

        <div className="dual-line-chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="line-svg dual-line-svg">
            <defs>
              <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="rgba(78, 205, 196, 0.32)" />
                <stop offset="100%" stopColor="rgba(78, 205, 196, 0)" />
              </linearGradient>
            </defs>

            <polyline
              points={`0,${H} ${dataPath} ${W},${H}`}
              fill="url(#trendArea)"
              stroke="none"
            />
            <polyline
              points={avgPath}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              strokeLinecap="round"
              className="dual-line-avg"
            />
            <polyline
              points={dataPath}
              fill="none"
              stroke="#4ECDC4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="trend-line dual-line-actual"
            />

            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="4.5"
              fill="#4ECDC4"
              stroke="#0d0d14"
              strokeWidth="2"
              className="dual-line-marker"
            />
          </svg>
        </div>

        <div className="chart-footer">
          <span className="footer-label">{series.length}d ago</span>
          <span className="footer-label">Today</span>
        </div>
      </div>
    );
  }

  SpotMe.TrendChart = TrendChart;
})();
