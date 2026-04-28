/* ============================================================
   SpotMe — ActivitiesPage
   Day-pill date strip, Steps + Waters tiles, large kcal display,
   weekly bar chart with active-day pill callout, and a "Body
   Exercise" wave card with kcal/bpm chips.
   Powers itself off /api/metrics + /api/tracker/stats so existing
   workout logging still drives the bar chart.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useMemo, useCallback } = React;
  const {
    FootprintsIcon, WaterDropIcon, FlameIcon, HeartIcon, ArrowLeftIcon
  } = SpotMe.icons;

  /* ---------- helpers ---------- */
  function isoDay(d) { return d.toISOString().slice(0, 10); }
  function shortMonth(d) { return d.toLocaleDateString('en-US', { month: 'short' }); }

  function buildDayStrip(centerStr) {
    const center = centerStr ? new Date(centerStr + 'T00:00:00Z') : new Date();
    center.setUTCHours(0, 0, 0, 0);
    const days = [];
    for (let off = -2; off <= 2; off++) {
      const d = new Date(center.getTime() + off * 86400000);
      days.push({
        iso: isoDay(d),
        date: d.getUTCDate(),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        month: shortMonth(d),
        isCenter: off === 0,
        isToday: isoDay(d) === isoDay(new Date())
      });
    }
    return days;
  }

  /* ---------- weekly bar chart ---------- */
  function BarChart({ data, activeIndex }) {
    const max = Math.max(1, ...data.map(d => d.value));
    return (
      <div className="fit-bar-chart">
        <div className="fit-bar-chart-head">
          <span className="fit-bar-chart-title">Statistic</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Weekly</span>
        </div>
        <div className="fit-bars">
          {data.map((d, i) => {
            const pct = (d.value / max) * 100;
            const active = i === activeIndex;
            return (
              <div
                key={d.label}
                className={`fit-bar-col${active ? ' is-active' : ''}${i % 2 === 0 ? ' is-warm' : ''}`}
              >
                <div className="fit-bar-track">
                  {active && (
                    <span className="fit-bar-callout">{d.value} kcal</span>
                  )}
                  <div className="fit-bar-fill" style={{ height: `${Math.max(6, pct)}%` }} />
                </div>
                <span className="fit-bar-label">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- body exercise wave ---------- */
  function WaveCard({ values, label, kcal, bpm, durationLabel }) {
    if (!values || values.length === 0) {
      values = Array.from({ length: 16 }, (_, i) => 30 + Math.sin(i / 2) * 12 + Math.random() * 6);
    }
    const w = 320, h = 110, pad = 4;
    const max = Math.max(...values), min = Math.min(...values);
    const range = max - min || 1;
    const step = (w - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => [
      pad + i * step,
      pad + (1 - (v - min) / range) * (h - pad * 2)
    ]);
    const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : ` L${x},${y}`)).join('');
    const area = `${path} L${w - pad},${h} L${pad},${h} Z`;

    return (
      <div className="fit-wave-card">
        <div className="fit-wave-head">
          <div className="fit-wave-title-block">
            <div className="fit-wave-step">2/15 Steps</div>
            <div className="fit-wave-title">{label || 'Body Exercise'}</div>
          </div>
          <div className="fit-wave-chips">
            {kcal != null && (
              <span className="fit-wave-chip is-flame">
                <span style={{ width: 10, height: 10, display: 'inline-flex' }}><FlameIcon /></span>
                {kcal} kcal
              </span>
            )}
            {bpm != null && (
              <span className="fit-wave-chip is-heart">
                <span style={{ width: 10, height: 10, display: 'inline-flex' }}><HeartIcon /></span>
                {bpm} bpm
              </span>
            )}
          </div>
        </div>
        <svg className="fit-wave-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--acc-success)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--acc-success)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#waveFill)" />
          <path d={path} fill="none" stroke="var(--acc-success)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {durationLabel && <span className="fit-wave-time">{durationLabel}</span>}
      </div>
    );
  }

  /* ---------- main page ---------- */
  function ActivitiesPage({ profile, route, onNavigate, onBack }) {
    const initialDay = route?.day || isoDay(new Date());
    const [selectedDay, setSelectedDay] = useState(initialDay);
    const [metrics, setMetrics] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadAll = useCallback(async () => {
      setLoading(true);
      const [m, s] = await Promise.all([
        SpotMe.api.getMetrics(7),
        SpotMe.api.getTrackerStats()
      ]);
      if (m.ok) setMetrics(m.data.metrics || []);
      if (s.ok) setStats(s.data.stats);
      setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const dayStrip = useMemo(() => buildDayStrip(selectedDay), [selectedDay]);

    const todayMetric = useMemo(() => {
      if (!metrics) return null;
      return metrics.find(m => m.day === selectedDay) || metrics[metrics.length - 1] || null;
    }, [metrics, selectedDay]);

    // Weekly bar data: prefer metrics calories; fall back to tracker weeklyActivity.
    const weeklyData = useMemo(() => {
      const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      if (metrics && metrics.length === 7) {
        return metrics.map(m => {
          const d = new Date(m.day + 'T00:00:00Z');
          const idx = (d.getUTCDay() + 6) % 7;
          return { label: days[idx], value: m.calories || 0 };
        });
      }
      if (stats?.weeklyActivity) {
        return stats.weeklyActivity.map((v, i) => ({ label: days[i] || `D${i+1}`, value: v }));
      }
      return days.map(d => ({ label: d, value: 0 }));
    }, [metrics, stats]);

    const activeIdx = useMemo(() => {
      const today = isoDay(new Date());
      const target = selectedDay || today;
      const targetD = new Date(target + 'T00:00:00Z');
      const idx = (targetD.getUTCDay() + 6) % 7;
      return idx;
    }, [selectedDay]);

    return (
      <div className="fit-home">
        <header className="fit-topbar">
          <button
            type="button"
            className="fit-icon-btn"
            onClick={onBack}
            aria-label="Back"
          >
            <span style={{ width: 18, height: 18, display: 'inline-flex' }}><ArrowLeftIcon /></span>
          </button>
          <h1 className="fit-topbar-title">Your Activities</h1>
          <div style={{ width: 40 }} />
        </header>

        <div className="fit-page">
          <div className="fit-day-pills">
            {dayStrip.map(d => {
              const isActive = d.iso === selectedDay;
              return (
                <button
                  key={d.iso}
                  type="button"
                  className={`fit-day${isActive ? ' is-active' : ''}`}
                  onClick={() => setSelectedDay(d.iso)}
                >
                  <span>{isActive ? `Today, ${d.date} ${d.month}` : d.date}</span>
                  {!isActive && <span className="fit-day-day">{d.weekday}</span>}
                </button>
              );
            })}
          </div>

          <div className="fit-metric-row">
            <div className="fit-metric-tile">
              <div className="fit-metric-tile-head">
                <span className="fit-metric-name">Steps</span>
                <span className="fit-metric-icon">
                  <span style={{ width: 14, height: 14, display: 'inline-flex' }}><FootprintsIcon /></span>
                </span>
              </div>
              <div className="fit-metric-value t-mono-num">
                {(todayMetric?.steps ?? 1230).toLocaleString()}
              </div>
              <div className="fit-metric-unit">Steps</div>
            </div>
            <div className="fit-metric-tile">
              <div className="fit-metric-tile-head">
                <span className="fit-metric-name">Waters</span>
                <span className="fit-metric-icon is-water">
                  <span style={{ width: 14, height: 14, display: 'inline-flex' }}><WaterDropIcon /></span>
                </span>
              </div>
              <div className="fit-metric-value t-mono-num">
                {(todayMetric?.waterLiters ?? 1.8).toFixed(1)}
              </div>
              <div className="fit-metric-unit">Liters</div>
            </div>
          </div>

          <div className="fit-calories">
            <div className="fit-calories-label">Calories</div>
            <div className="fit-calories-value t-mono-num">
              {(todayMetric?.calories ?? 2350).toLocaleString()}
              <small>kcal</small>
            </div>
          </div>

          <BarChart data={weeklyData} activeIndex={activeIdx} />

          <WaveCard
            values={null}
            label="Body Exercise"
            kcal={48}
            bpm={102}
            durationLabel="08:03 mins"
          />

          {loading && (
            <div className="fit-loading"><span className="fit-spinner" />Loading…</div>
          )}
        </div>
      </div>
    );
  }

  SpotMe.ActivitiesPage = ActivitiesPage;
})();
