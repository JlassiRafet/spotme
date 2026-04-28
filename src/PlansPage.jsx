/* ============================================================
   SpotMe — PlansPage
   Free vs Pro pricing with Stripe checkout integration.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
  const { CrownIcon } = SpotMe.icons;

  const FREE_DAILY_MESSAGES = 20;
  const FREE_SESSION_LIMIT  = 5;

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

  function CheckIcon({ pro }) {
    return (
      <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
        <circle cx="7" cy="7" r="7" fill={pro ? 'rgba(32,200,180,0.18)' : 'rgba(255,255,255,0.1)'} />
        <polyline points="3,7 5.5,10 11,4" stroke={pro ? '#20c8b4' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  function LockSmall() {
    return (
      <svg viewBox="0 0 14 14" fill="none" width="11" height="11" style={{ marginRight: 4, opacity: 0.55 }}>
        <rect x="2" y="6" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
  }

  const FREE_FEATURES = [
    { label: `AI chat coaching (${FREE_DAILY_MESSAGES} msgs/day)`, locked: false },
    { label: 'Basic workout builder', locked: false },
    { label: 'Equipment identifier', locked: false },
    { label: `Session history (last ${FREE_SESSION_LIMIT})`, locked: false },
    { label: 'Community access', locked: false },
  ];

  const PRO_FEATURES = [
    { label: 'Unlimited AI coaching', locked: false },
    { label: 'Full session history', locked: false },
    { label: 'Progress tracking & PR charts', locked: false },
    { label: 'Adaptive weekly programming', locked: false },
    { label: 'Priority response speed', locked: false },
    { label: 'Goal streak analytics', locked: false },
    { label: 'Advanced nutrition guidance', locked: false },
    { label: 'Export workout data (CSV / PDF)', locked: false },
  ];

  /* ── Upsell modal ──────────────────────────────────────────── */
  function ProUpsellModal({ onUpgrade, onClose, loading }) {
    const overlayRef = useRef(null);
    useEffect(() => {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
      <div className="settings-modal-overlay"
           ref={overlayRef}
           onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
        <div className="pro-upsell-modal">
          <button type="button" className="settings-modal-close" onClick={onClose}
                  style={{ position: 'absolute', top: 14, right: 14 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div className="pro-upsell-crown"><CrownIcon /></div>
          <h3 className="pro-upsell-title">Unlock SpotMe Pro</h3>
          <p className="pro-upsell-sub">Get unlimited coaching, full history, and advanced tracking.</p>
          <ul className="pro-upsell-list">
            {PRO_FEATURES.slice(0, 5).map((f, i) => (
              <li key={i}><CheckIcon pro /> {f.label}</li>
            ))}
          </ul>
          <div className="pro-upsell-price">
            <span className="pro-upsell-amount">$12</span>
            <span className="pro-upsell-period">/ month</span>
          </div>
          <button type="button" className="pro-upsell-btn" onClick={onUpgrade} disabled={loading}>
            {loading ? 'Redirecting to checkout…' : 'Upgrade to Pro →'}
          </button>
          <p className="pro-upsell-note">Cancel anytime. No questions asked.</p>
        </div>
      </div>
    );
  }

  /* Make the modal globally accessible */
  SpotMe.ProUpsellModal = ProUpsellModal;

  /* ── PlansPage ─────────────────────────────────────────────── */
  function PlansPage({ profile, onBack, onNavigate }) {
    const [gridRef, gridInView] = useInView(0.05);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [portalLoading,   setPortalLoading]   = useState(false);
    const [cancelLoading,   setCancelLoading]   = useState(false);
    const [error, setError]                     = useState('');
    const [subStatus, setSubStatus]             = useState(null);

    /* Read checkout result from URL */
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutResult = urlParams.get('checkout'); // 'success' | 'canceled'

    const isPro    = profile && profile.plan === 'pro';
    const isFree   = !isPro;

    /* Fetch current subscription status + Stripe config flag */
    useEffect(() => {
      SpotMe.api.request('/api/subscription/status')
        .then(r => { if (r.ok) setSubStatus(r.data); })
        .catch(() => {});
    }, [profile]);

    const stripeReady = subStatus?.stripeConfigured === true;

    /* Stripe checkout */
    async function handleUpgrade() {
      setError('');
      setCheckoutLoading(true);
      const r = await SpotMe.api.request('/api/subscription/checkout', { method: 'POST', body: {} });
      setCheckoutLoading(false);
      if (r.ok && r.data.url) {
        window.location.href = r.data.url;
      } else {
        setError(r.error || 'Could not start checkout. Make sure Stripe is configured in .env.');
      }
    }

    /* Stripe billing portal */
    async function handleManage() {
      setError('');
      setPortalLoading(true);
      const r = await SpotMe.api.request('/api/subscription/portal', { method: 'POST', body: {} });
      setPortalLoading(false);
      if (r.ok && r.data.url) {
        window.location.href = r.data.url;
      } else {
        setError(r.error || 'Could not open billing portal.');
      }
    }

    /* Cancel subscription */
    async function handleCancel() {
      if (!window.confirm('Cancel your Pro subscription? You\'ll keep Pro access until the end of your billing period.')) return;
      setError('');
      setCancelLoading(true);
      const r = await SpotMe.api.request('/api/subscription/cancel', { method: 'POST', body: {} });
      setCancelLoading(false);
      if (r.ok) {
        setSubStatus(prev => ({ ...prev, cancelAtPeriodEnd: true, subscriptionEnd: r.data.subscriptionEnd }));
      } else {
        setError(r.error || 'Could not cancel subscription.');
      }
    }

    const endDate = (subStatus?.subscriptionEnd || profile?.subscriptionEnd)
      ? new Date(subStatus?.subscriptionEnd || profile?.subscriptionEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : null;

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

        {/* Checkout result banners */}
        {checkoutResult === 'success' && (
          <div className="plans-toast plans-toast--success">
            🎉 Welcome to SpotMe Pro! Your subscription is now active.
          </div>
        )}
        {checkoutResult === 'canceled' && (
          <div className="plans-toast plans-toast--canceled">
            Checkout was canceled. You can upgrade anytime.
          </div>
        )}
        {error && <div className="plans-toast plans-toast--error">{error}</div>}

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

          {/* ── Free card ── */}
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
                  {f.label}
                </li>
              ))}
            </ul>
            <div style={{ flex: 1 }} />
            <div className="plan-divider" />
            <button type="button" className={`plan-cta${isFree ? ' plan-cta-current' : ''}`}
                    disabled style={{ marginTop: 8 }}>
              {isFree ? '✓ Current plan' : 'Free plan'}
            </button>
          </div>

          {/* ── Pro card ── */}
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
                  <span className="plan-feature-check"><CheckIcon pro /></span>
                  {f.label}
                </li>
              ))}
            </ul>
            <div style={{ flex: 1 }} />
            <div className="plan-divider" />

            {isPro ? (
              /* Active Pro — subscription management */
              <div className="plan-manage" style={{ marginTop: 8 }}>
                <div className="plan-manage-status">
                  <span className="plan-pro-badge-inline">PRO</span>
                  {subStatus?.cancelAtPeriodEnd
                    ? <span className="plan-manage-note">Cancels {endDate}</span>
                    : endDate
                    ? <span className="plan-manage-note">Renews {endDate}</span>
                    : null}
                </div>
                <button type="button" className="plan-cta plan-cta-manage"
                        onClick={handleManage} disabled={portalLoading} style={{ marginTop: 10 }}>
                  {portalLoading ? 'Opening portal…' : 'Manage billing →'}
                </button>
                {!subStatus?.cancelAtPeriodEnd && (
                  <button type="button" className="plan-cancel-link"
                          onClick={handleCancel} disabled={cancelLoading}>
                    {cancelLoading ? 'Canceling…' : 'Cancel subscription'}
                  </button>
                )}
              </div>
            ) : stripeReady ? (
              /* Free user — upgrade CTA (Stripe configured) */
              <button type="button" className="plan-cta plan-cta-primary"
                      onClick={handleUpgrade} disabled={checkoutLoading}
                      style={{ marginTop: 8 }}>
                {checkoutLoading ? 'Redirecting…' : 'Upgrade to Pro →'}
              </button>
            ) : (
              /* Stripe not configured yet */
              <div className="plan-stripe-pending">
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 5v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Payment coming soon
              </div>
            )}
          </div>
        </div>

        <p className="plans-footnote">
          All plans include end-to-end encryption and data privacy.
          Billed monthly. Cancel anytime — no questions asked.
        </p>
      </div>
    );
  }

  SpotMe.PlansPage = PlansPage;
})();
