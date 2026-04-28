/* ============================================================
   SpotMe — Privacy Policy Page
   ============================================================ */
(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  function PrivacyPage({ onBack }) {
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
          <h1 className="h-display" style={{ margin: 0, fontSize: '1.5rem' }}>Privacy Policy</h1>
        </div>
        <div className="settings-card" style={{ padding: 20, color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: 12 }}>Last updated: April 2026</p>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>Information Collection</h2>
          <p style={{ marginBottom: 16 }}>We collect information you provide directly to us when you create an account, log workouts, or interact with the AI Coach.</p>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>Use of Information</h2>
          <p style={{ marginBottom: 16 }}>We use the information we collect to provide, maintain, and improve our services, and to develop new features.</p>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>Data Security</h2>
          <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access.</p>
        </div>
      </div>
    );
  }

  SpotMe.PrivacyPage = PrivacyPage;
})();
