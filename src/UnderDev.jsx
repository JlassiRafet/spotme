/* ============================================================
   SpotMe — Under Development placeholder view
   Reusable panel used by the Tracker page and any future
   not-yet-built feature. Takes an optional userName and an
   optional title/body.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});

  function UnderDev({ title = 'Under Development', body, userName }) {
    const message = body || (
      (userName ? `Welcome, ${userName}! ` : '') +
      "This page is being built. Check back soon — we're cooking up something good."
    );
    return (
      <div className="wip-panel">
        <div className="home-wip">
          <div className="home-wip-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <h2 className="home-wip-title">{title}</h2>
          <p className="home-wip-text">{message}</p>
        </div>
      </div>
    );
  }

  SpotMe.UnderDev = UnderDev;
})();
