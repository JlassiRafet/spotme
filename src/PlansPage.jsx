/* ============================================================
   SpotMe — PlansPage
   Free vs Pro pricing, accessible from sidebar.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
  const { CrownIcon } = SpotMe.icons;

  function useInView(threshold) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { setInView(true); obs.disconnect(); }
      }, { threshold: threshold || 0.1 });
      obs.observe(el);
      return () => obs.disconnect();
    }, []);
    return [ref, inView];
  }

  function CheckIcon() {
    return (
      <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
        <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  const FREE_FEATURES = [
    'AI chat coaching (20 msgs/day)',
    'Basic workout builder',
    'Equipment identifier',
    'Session history (last 7 days)',
    'Community access',
  ];

  const PRO_FEATURES = [
    'Unlimited AI coaching',
    'Full session history',
    'Progress tracking & PR charts',
    'Adaptive weekly programming',
    'Priority response speed',
    'Goal streak analytics',
    'Advanced nutrition guidance',
    'Export workout data (CSV / PDF)',
  ];

  function PlansPage({ onBack }) {
    const [gridRef, gridInView] = useInView(0.05);

    return (
      <div className="plans-page">
        {onBack && (
          <button type="button" className="plans-page-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
        )}

        <div className="plans-page-header"
             style={{
               opacity: gridInView ? 1 : 0,
               transform: gridInView ? 'none' : 'translateY(20px)',
               transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
             }}>
          <div className="marketing-section-tag" style={{ margin: '0 auto 18px' }}>Pricing</div>
          <div className="marketing-plans-title">
            Start free. <span>Go Pro</span> when ready.
          </div>
          <p className="marketing-plans-sub">No credit card needed. Cancel anytime.</p>
        </div>

        <div ref={gridRef} className="plans-grid">
          {/* Free */}
          <div className="plan-card plan-free"
               style={{ animation: gridInView ? 'fadeSlideUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.05s both' : 'none' }}>
            <div>
              <div className="plan-name">Free</div>
              <div className="plan-price">
                <span className="plan-price-amount">$0</span>
                <span className="plan-price-period">/ forever</span>
              </div>
            </div>
            <p className="plan-desc">Everything you need to get moving with AI coaching.</p>
            <div className="plan-divider" />
            <ul className="plan-features">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="plan-feature">
                  <span className="plan-feature-check"><CheckIcon /></span>
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ flex: 1 }} />
            <div className="plan-divider" />
            <button type="button" className="plan-cta" style={{ marginTop: 8 }}>
              Current plan
            </button>
          </div>

          {/* Pro */}
          <div className="plan-card plan-pro"
               style={{ animation: gridInView ? 'fadeSlideUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.18s both' : 'none' }}>
            <span className="plan-badge recommended">Recommended</span>
            <div>
              <div className="plan-name">Pro</div>
              <div className="plan-price">
                <span className="plan-price-amount">$12</span>
                <span className="plan-price-period">/ month</span>
              </div>
            </div>
            <p className="plan-desc">The full coaching suite. Unlimited AI, tracking, and more.</p>
            <div className="plan-divider" />
            <ul className="plan-features">
              {PRO_FEATURES.map((f, i) => (
                <li key={i} className="plan-feature">
                  <span className="plan-feature-check"><CheckIcon /></span>
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ flex: 1 }} />
            <div className="plan-divider" />
            <button type="button" className="plan-cta plan-cta-primary" style={{ marginTop: 8 }}>
              Upgrade to Pro
            </button>
          </div>
        </div>

        <p style={{ marginTop: 40, fontSize: '0.82rem', color: '#a07038', textAlign: 'center', maxWidth: 480 }}>
          All plans include end-to-end encryption and data privacy.
          Billed monthly. Cancel anytime — no questions asked.
        </p>
      </div>
    );
  }

  SpotMe.PlansPage = PlansPage;
})();
