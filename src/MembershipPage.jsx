/* ============================================================
   SpotMe — MembershipPage
   The crown-tab destination. Replaces the legacy PlansPage with
   the v3 design system: hero band, two tier cards (Free + Pro)
   styled with the mint accent.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState } = React;
  const { CrownIcon, ArrowLeftIcon } = SpotMe.icons;

  const FREE_FEATURES = [
    'AI chat coaching (20 msgs/day)',
    'Basic workout builder',
    'Equipment identifier',
    'Session history (last 7 days)',
    'Community access'
  ];

  const PRO_FEATURES = [
    'Private 1:1 coaching with a real SpotMe coach (not AI-only)',
    'Scheduled video or phone calls included with your coach',
    'Human-written programming, form checks & accountability',
    'Unlimited AI coaching in the app between live sessions',
    'Full session history & progress shared with your coach',
    'Goal streak analytics & export workout data'
  ];

  function MembershipPage({ profile, onBack }) {
    const isPro = profile?.plan === 'pro';
    const [upgrading, setUpgrading] = useState(false);
    const [message, setMessage] = useState(null);

    const upgrade = async () => {
      setMessage(null);
      setUpgrading(true);
      try {
        const r = await SpotMe.api.requestUpgrade();
        if (r.ok && r.data?.url) {
          window.location.href = r.data.url;
          return;
        }
        const isUnconfigured = r.status === 503 || (r.error || '').includes('not configured');
        setMessage(isUnconfigured
          ? 'Pro payments are coming soon — email us at rafet.main@gmail.com to get early access.'
          : (r.error || 'Could not start checkout. Please try again.'));
      } finally {
        setUpgrading(false);
      }
    };

    return (
      <div className="fit-home">
        <header className="fit-topbar">
          {onBack && (
            <button
              type="button"
              className="fit-icon-btn"
              onClick={onBack}
              aria-label="Back"
            >
              <span style={{ width: 18, height: 18, display: 'inline-flex' }}><ArrowLeftIcon /></span>
            </button>
          )}
          <h1 className="fit-topbar-title">Membership</h1>
          <div style={{ width: 40 }} />
        </header>

        <div className="fit-page">
          <div className="fit-membership-hero">
            <div className="fit-membership-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, display: 'inline-flex' }}><CrownIcon /></span>
              {isPro ? 'You are Pro' : 'Pricing'}
            </div>
            <div className="fit-membership-title">
              {isPro
                ? 'Thanks for being a Pro member.'
                : 'Start free. Go Pro when ready.'}
            </div>
            <div className="fit-membership-sub">
              {isPro
                ? 'Your Pro membership includes private coaching and live calls with a real coach — plus full app access.'
                : 'Pro adds private coaching and scheduled calls with a real human coach — on top of AI in the app. No credit card to start on Free. Cancel anytime.'}
            </div>
          </div>

          <div className="fit-tier-grid">
            <div className="fit-tier-card">
              <div className="fit-tier-name">Free</div>
              <div className="fit-tier-price t-mono-num">
                $0<small>/ forever</small>
              </div>
              <ul className="fit-tier-features">
                {FREE_FEATURES.map(f => <li key={f}>{f}</li>)}
              </ul>
              <button type="button" className="fit-tier-cta" disabled>
                {isPro ? 'Downgrade' : 'Current plan'}
              </button>
            </div>

            <div className="fit-tier-card is-featured">
              <div className="fit-tier-name">Pro</div>
              <div className="fit-tier-price t-mono-num">
                $12<small>/ month</small>
              </div>
              <ul className="fit-tier-features">
                {PRO_FEATURES.map(f => <li key={f}>{f}</li>)}
              </ul>
              <button
                type="button"
                className="fit-tier-cta"
                onClick={upgrade}
                disabled={upgrading || isPro}
              >
                {isPro ? 'Active' : (upgrading ? 'Starting…' : 'Upgrade to Pro')}
              </button>
            </div>
          </div>

          {message && (
            <p style={{ marginTop: 12, color: 'var(--ink-3)', fontSize: '0.85rem' }}>
              {message}
            </p>
          )}

          <p style={{ marginTop: 24, fontSize: '0.78rem', color: 'var(--ink-3)' }}>
            Pro is built around private coaching and calls with a real coach — availability and session frequency are confirmed after you subscribe. All plans include end-to-end encryption. Billed monthly. Cancel anytime.
          </p>
        </div>
      </div>
    );
  }

  SpotMe.MembershipPage = MembershipPage;
})();
