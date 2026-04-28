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
    'Unlimited AI coaching',
    'Full session history',
    'Progress tracking & PR charts',
    'Adaptive weekly programming',
    'Priority response speed',
    'Goal streak analytics',
    'Advanced nutrition guidance',
    'Export workout data'
  ];

  function MembershipPage({ profile, onBack }) {
    const isPro = profile?.plan === 'pro';
    const [upgrading, setUpgrading] = useState(false);
    const [message, setMessage] = useState(null);

    const upgrade = async () => {
      setUpgrading(true);
      const r = await SpotMe.api.requestUpgrade();
      setUpgrading(false);
      setMessage(r.ok
        ? 'Upgrade flow not yet available — coming soon.'
        : (r.error || 'Could not start upgrade.'));
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
                ? 'You have access to every coaching feature, unlimited history, and priority response speed.'
                : 'No credit card needed. Cancel anytime.'}
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
            All plans include end-to-end encryption. Billed monthly. Cancel anytime.
          </p>
        </div>
      </div>
    );
  }

  SpotMe.MembershipPage = MembershipPage;
})();
