/* ============================================================
   SpotMe — HomePage (marketing)
   Interactive public landing page with gym imagery, animations,
   scroll-triggered reveals, liquid glass cards.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef, useCallback } = React;
  const { SpotMeLogo, SparkleIcon } = SpotMe.icons;

  /* ── Scroll-reveal hook ─────────────────────────────────── */
  function useInView(threshold) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { setInView(true); obs.disconnect(); }
      }, { threshold: threshold || 0.12 });
      obs.observe(el);
      return () => obs.disconnect();
    }, []);
    return [ref, inView];
  }

  function Reveal({ children, delay = 0, y = 32 }) {
    const [ref, inView] = useInView();
    return (
      <div ref={ref} style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : `translateY(${y}px)`,
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}>
        {children}
      </div>
    );
  }

  /* ── Feature cards data ─────────────────────────────────── */
  const FEATURES = [
    {
      title: 'Adaptive sessions',
      body: 'Workouts that reshape themselves around how you actually felt yesterday.',
      img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=60',
      tag: 'Smart planning',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      ),
    },
    {
      title: 'Know your numbers',
      body: 'Progress tracking that\'s honest — not just a graph that only ever goes up.',
      img: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=60',
      tag: 'Progress tracking',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
      ),
    },
    {
      title: 'One coach, always',
      body: 'Your coach remembers the context. No restart-from-zero between sessions.',
      img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=60',
      tag: 'Persistent memory',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      title: 'Identify equipment',
      body: 'Point your camera at any gym machine. Instant breakdown — muscles, form, safety.',
      img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=60',
      tag: 'AI vision',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      ),
    },
  ];

  /* ── Why us stats ───────────────────────────────────────── */
  const STATS = [
    { value: '< 1s', label: 'AI response time' },
    { value: '70B', label: 'Parameter model' },
    { value: '∞', label: 'Session memory' },
    { value: '100%', label: 'Private by default' },
  ];

  /* ── Feature card with parallax image on hover ──────────── */
  function FeatureCard({ feature, delay }) {
    const [hovered, setHovered] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
    const cardRef = useRef(null);

    const onMouseMove = useCallback((e) => {
      const rect = cardRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top)  / rect.height) * 100,
      });
    }, []);

    return (
      <Reveal delay={delay}>
        <div ref={cardRef} className="feature-card"
             onMouseEnter={() => setHovered(true)}
             onMouseLeave={() => setHovered(false)}
             onMouseMove={onMouseMove}>
          {/* Gym image background */}
          <div className="feature-card-bg"
               style={{
                 backgroundImage: `url(${feature.img})`,
                 transform: hovered
                   ? `scale(1.08) translate(${(mousePos.x - 50) * -0.04}%, ${(mousePos.y - 50) * -0.04}%)`
                   : 'scale(1)',
               }} />
          {/* Liquid glass overlay */}
          <div className="feature-card-glass" />
          {/* Content */}
          <div className="feature-card-content">
            <div className="feature-card-tag">
              <span className="feature-card-icon">{feature.icon}</span>
              {feature.tag}
            </div>
            <h3 className="feature-card-title">{feature.title}</h3>
            <p className="feature-card-body">{feature.body}</p>
          </div>
        </div>
      </Reveal>
    );
  }

  /* ── Main page ──────────────────────────────────────────── */
  function HomePage({ onGoToLogin, onGoToSignup }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
      const onScroll = () => setScrolled(window.scrollY > 40);
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
      <div className="marketing-shell">

        {/* ── Sticky nav ──────────────────────────────────────── */}
        <header className={`marketing-nav${scrolled ? ' is-scrolled' : ''}`}>
          <div className="marketing-brand">
            <SpotMeLogo size={32} />
            <span className="spotme-wordmark">SpotMe</span>
          </div>
          <nav className="marketing-actions">
            <button type="button" className="btn-text" onClick={onGoToLogin}>Log in</button>
            <button type="button" className="btn-base btn-primary liquid marketing-cta" onClick={onGoToSignup}>
              <span className="btn-glow" />
              <span className="btn-label">Get started</span>
            </button>
          </nav>
        </header>

        {/* ── Hero ────────────────────────────────────────────── */}
        <main className="marketing-hero">
          <div className="hero-bg-blur" aria-hidden="true" />
          <div className="hero-orb hero-orb-1" aria-hidden="true" />
          <div className="hero-orb hero-orb-2" aria-hidden="true" />

          <div className="marketing-badge hero-reveal-1">
            <SparkleIcon /> <span>Powered by Llama 3.3 70B</span>
          </div>
          <h1 className="marketing-title hero-reveal-2">
            Train smarter.<br/>
            <span className="marketing-title-accent">Built around you.</span>
          </h1>
          <p className="marketing-sub hero-reveal-3">
            SpotMe is the AI coach that remembers your goals, your gear, and
            your last workout — so every session builds on the one before.
          </p>
          <div className="marketing-hero-cta hero-reveal-4">
            <button type="button" className="btn-base btn-primary liquid" style={{ minWidth: 200 }} onClick={onGoToSignup}>
              <span className="btn-glow" />
              <span className="btn-label">Start for free</span>
            </button>
            <button type="button" className="btn-text marketing-ghost" onClick={onGoToLogin}>
              Already have an account →
            </button>
          </div>
        </main>

        {/* ── Stats bar ───────────────────────────────────────── */}
        <Reveal>
          <div className="marketing-stats-bar">
            {STATS.map((s, i) => (
              <div key={i} className="marketing-stat">
                <div className="marketing-stat-value">{s.value}</div>
                <div className="marketing-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ── Features grid ───────────────────────────────────── */}
        <section className="marketing-features-section" aria-label="Features">
          <Reveal>
            <div className="marketing-section-tag">Why SpotMe</div>
            <h2 className="marketing-section-title">
              Everything a real coach<br/>would remember.
            </h2>
          </Reveal>
          <div className="feature-cards-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} feature={f} delay={i * 80} />
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────── */}
        <section className="marketing-how-section">
          <Reveal>
            <div className="marketing-section-tag">How it works</div>
            <h2 className="marketing-section-title">Three steps. One coach.</h2>
          </Reveal>
          <div className="how-steps-row">
            {[
              { num: '01', title: 'Tell it about yourself', body: 'Your goals, injuries, experience level — once, not every session.' },
              { num: '02', title: 'Chat before every session', body: 'Get a personalised plan in seconds. Adjust on the fly.' },
              { num: '03', title: 'Review and grow', body: 'Log how it went. The AI factors that into your next workout.' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="how-step-card liquid">
                  <div className="how-step-num">{s.num}</div>
                  <h3 className="how-step-title">{s.title}</h3>
                  <p className="how-step-body">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── CTA band ────────────────────────────────────────── */}
        <Reveal>
          <section className="marketing-cta-band">
            <div className="cta-band-glow" aria-hidden="true" />
            <h2 className="cta-band-title">Ready to train with intent?</h2>
            <p className="cta-band-sub">Free forever. No credit card. Start in 30 seconds.</p>
            <button type="button" className="btn-base btn-primary liquid" style={{ minWidth: 220 }} onClick={onGoToSignup}>
              <span className="btn-glow" />
              <span className="btn-label">Create your account</span>
            </button>
          </section>
        </Reveal>

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
