/* ============================================================
   SpotMe — Public marketing home page
   Shown when no user is logged in. Has Log In / Sign Up in the
   top-right corner that route to the AuthCard flow, plus a hero
   section and a tiny teaser for the under-development features.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { SpotMeLogo, SparkleIcon } = SpotMe.icons;

  function HomePage({ onGoToLogin, onGoToSignup }) {
    return (
      <div className="marketing-shell">
        <header className="marketing-nav">
          <div className="marketing-brand">
            <SpotMeLogo size={32} />
            <span className="spotme-wordmark">SpotMe</span>
          </div>
          <nav className="marketing-actions">
            <button type="button" className="btn-text" onClick={onGoToLogin}>Log in</button>
            <button type="button"
                    className="btn-base btn-primary liquid marketing-cta"
                    onClick={onGoToSignup}>
              <span className="btn-glow" />
              <span className="btn-label">Sign up</span>
            </button>
          </nav>
        </header>

        <main className="marketing-hero">
          <div className="marketing-badge">
            <SparkleIcon /> <span>Your AI fitness coach</span>
          </div>
          <h1 className="marketing-title">
            Train smarter.<br/>
            <span className="marketing-title-accent">Built around you.</span>
          </h1>
          <p className="marketing-sub">
            SpotMe is the AI coach that remembers your goals, your gear, and
            your last workout — so every session builds on the one before.
          </p>
          <div className="marketing-hero-cta">
            <button type="button"
                    className="btn-base btn-primary liquid"
                    style={{ width: 220 }}
                    onClick={onGoToSignup}>
              <span className="btn-glow" />
              <span className="btn-label">Get started</span>
            </button>
            <button type="button" className="btn-text marketing-ghost" onClick={onGoToLogin}>
              I already have an account →
            </button>
          </div>
        </main>

        <section className="marketing-features" aria-label="Features">
          {[
            { title: 'Adaptive sessions', body: 'Workouts that reshape themselves around how you actually felt yesterday.' },
            { title: 'Know your numbers', body: 'Progress tracking that\'s honest — not just a graph that only ever goes up.' },
            { title: 'One coach, always', body: 'Your coach remembers the context. No restart-from-zero between sessions.' }
          ].map((f, i) => (
            <div className="marketing-feature liquid" key={i}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </section>

        <footer className="marketing-footer">
          <div className="marketing-footer-brand">
            <SpotMeLogo size={20} />
            <span>SpotMe</span>
          </div>
          <span className="marketing-footer-note">© 2026 SpotMe · Under development</span>
        </footer>
      </div>
    );
  }

  SpotMe.HomePage = HomePage;
})();
