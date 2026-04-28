/* ============================================================
   SpotMe — Help Center Page
   ============================================================ */
(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  function HelpCenterPage({ onBack }) {
    return (
      <div className="fit-page" style={{ paddingTop: 20 }}>
        <div className="flex items-center mb-6">
          <button type="button" onClick={onBack} className="fit-icon-btn mr-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="h-display" style={{ margin: 0, fontSize: '1.5rem' }}>Help Center</h1>
        </div>
        <div className="settings-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: 600 }}>Frequently Asked Questions</h2>
          <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            <strong>How do I track my workouts?</strong><br/>
            You can use the Tracker page or the AI Coach to log your exercises.
          </p>
          <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            <strong>How do I cancel my PRO subscription?</strong><br/>
            You can manage your subscription from the Account section in your Profile.
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            Need more help? <a href="mailto:support@spotme.ai" style={{ color: 'var(--acc-mint)', textDecoration: 'underline' }}>Contact Support</a>
          </p>
        </div>
      </div>
    );
  }

  SpotMe.HelpCenterPage = HelpCenterPage;
})();
