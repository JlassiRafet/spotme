/* ============================================================
   SpotMe — Terms of Use Page
   ============================================================ */
(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  function TermsPage({ onBack }) {
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
          <h1 className="h-display" style={{ margin: 0, fontSize: '1.5rem' }}>Terms of Use</h1>
        </div>
        <div className="settings-card" style={{ padding: 20, color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: 12 }}>Last updated: April 2026</p>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>1. Acceptance of Terms</h2>
          <p style={{ marginBottom: 16 }}>By accessing and using SpotMe, you agree to be bound by these Terms of Use.</p>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>2. Use License</h2>
          <p style={{ marginBottom: 16 }}>Permission is granted to temporarily download one copy of SpotMe for personal, non-commercial transitory viewing only.</p>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>3. Disclaimer</h2>
          <p>The materials on SpotMe are provided on an 'as is' basis. SpotMe makes no warranties, expressed or implied, and hereby disclaims all other warranties including fitness for a particular purpose.</p>
        </div>
      </div>
    );
  }

  SpotMe.TermsPage = TermsPage;
})();
