/* ============================================================
   SpotMe — HomePage (marketing)
   Design: Framer-inspired — Oswald bold, teal #79CBCA, black bg
   Sections: pill nav · hero · stats · features · benefits ·
             integrations · testimonials ticker · CTA · footer
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef, useCallback } = React;
  const { SpotMeLogo } = SpotMe.icons;

  /* ── Scroll-reveal ─────────────────────────────────────── */
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

  function Reveal({ children, delay = 0, y = 28 }) {
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

  /* ── Section label ─────────────────────────────────────── */
  function SectionLabel({ children }) {
    return (
      <div className="marketing-section-tag" style={{ marginBottom: 14 }}>
        {children}
      </div>
    );
  }

  /* ── Data ──────────────────────────────────────────────── */
  const STATS = [
    { label: 'Active members',      kind: 'count',  prefix: '', from: 0, to: 12400, suffix: '+' },
    { label: 'Workouts logged',     kind: 'count',  prefix: '', from: 0, to: 87,    suffix: 'K+' },
    { label: 'Programs available',  kind: 'count',  prefix: '', from: 0, to: 18,    suffix: '' },
    { label: 'Avg. session rating', kind: 'symbol', value: '4.9★' },
  ];

  function formatCountStat(s, n) {
    const num = typeof n === 'number' ? Math.round(n) : n;
    return `${s.prefix ?? ''}${num}${s.suffix ?? ''}`;
  }

  /* ── Stats bar — Motion count-up when in view (stagger order) ─ */
  function AnimatedStat({ stat, index, active }) {
    const symRef = useRef(null);
    const [display, setDisplay] = useState(() =>
      stat.kind === 'symbol' ? stat.value : formatCountStat(stat, stat.from));

    useEffect(() => {
      if (!active) return undefined;

      let cancelled = false;
      let ctrl;
      const M = typeof window !== 'undefined' ? window.Motion : null;
      const staggerMs = index * 110;

      const t = setTimeout(() => {
        if (cancelled) return;
        if (!M?.animate) {
          if (stat.kind === 'symbol') {
            const el = symRef.current;
            if (el) {
              el.style.opacity = '1';
              el.style.transform = '';
            }
          } else setDisplay(formatCountStat(stat, stat.to));
          return;
        }

        if (stat.kind === 'symbol') {
          const el = symRef.current;
          if (!el) return;
          ctrl = M.animate(
            el,
            { opacity: 1, scale: 1 },
            { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
          );
          return;
        }

        ctrl = M.animate(stat.from, stat.to, {
          duration: 1.05,
          ease: [0.22, 1, 0.36, 1],
          onUpdate: (latest) => setDisplay(formatCountStat(stat, latest)),
          onComplete: () => setDisplay(formatCountStat(stat, stat.to)),
        });
      }, staggerMs);

      return () => {
        cancelled = true;
        clearTimeout(t);
        ctrl?.stop?.();
      };
    }, [active, stat, index]);

    if (stat.kind === 'symbol') {
      return (
        <div className="marketing-stat">
          <div
            ref={symRef}
            className="marketing-stat-value marketing-stat-value--infinity"
          >
            {stat.value}
          </div>
          <div className="marketing-stat-label">{stat.label}</div>
        </div>
      );
    }

    return (
      <div className="marketing-stat">
        <div className="marketing-stat-value">{display}</div>
        <div className="marketing-stat-label">{stat.label}</div>
      </div>
    );
  }

  function AnimatedStatsSection() {
    const [ref, inView] = useInView(0.12);
    return (
      <div
        ref={ref}
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'none' : 'translateY(28px)',
          transition:
            'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="marketing-stats-bar">
          {STATS.map((s, i) => (
            <AnimatedStat key={i} stat={s} index={i} active={inView} />
          ))}
        </div>
      </div>
    );
  }

  const FEATURES = [
    {
      title: 'Exercise library',
      body: '200+ exercises with step-by-step form cues, real muscle diagrams and sports-science tips — built for every level.',
      img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=60',
      tag: 'Programs',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M6.5 6.5h11M6.5 12h11M6.5 17.5h11"/><rect x="2" y="3" width="20" height="18" rx="2"/>
        </svg>
      ),
    },
    {
      title: 'Smart tracking',
      body: 'Log sets, reps and weight. Watch your strength curve grow over time with clear charts that show exactly where you are progressing.',
      img: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=60',
      tag: 'Progress',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
      ),
    },
    {
      title: 'Nutrition plans',
      body: 'Macro targets, meal-by-meal tips and full diet programs — Keto, Vegetarian, Mediterranean and more — tuned to your training goal.',
      img: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=60',
      tag: 'Nutrition',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2z"/><path d="M12 8v4l3 3"/>
        </svg>
      ),
    },
    {
      title: 'AI coach on-demand',
      body: 'Ask anything — form checks, programme adjustments, recovery advice. Your coach is always on and never forgets your history.',
      img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=60',
      tag: 'AI Coach',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
  ];

  const BENEFITS = [
    {
      title: 'Strength that compounds',
      body: 'Progressive overload is built into every program. You will always know exactly when and how much to push — no guesswork, no plateaus.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
    },
    {
      title: 'Dialled-in nutrition',
      body: 'Four complete diet programs — Macro, Vegetarian, Keto and Mediterranean — with daily tips, food examples and macro targets for your goal.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      ),
    },
    {
      title: 'Consistency, not motivation',
      body: 'Structured programs with step-by-step runners, rest timers and muscle maps take the decision-making out of every session — especially the hard days.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>
        </svg>
      ),
    },
  ];

  const INTEGRATIONS = [
    { name: 'Apple Watch', body: 'Sync heart rate, workout data and recovery metrics automatically after every session.' },
    { name: 'Strava',      body: 'Import runs and rides into your SpotMe history so your coach has the full picture.' },
    { name: 'MyFitnessPal',body: 'Connect nutrition data — your coach factors calories and macros into session planning.' },
    { name: 'Garmin',      body: 'Pull sleep, HRV and stress scores to calibrate intensity recommendations each morning.' },
    { name: 'Fitbit',      body: 'Continuous activity tracking feeds your weekly load model for smarter programming.' },
    { name: 'Google Fit',  body: 'Aggregate cross-platform data so nothing falls through the cracks in your training log.' },
  ];

  const TESTIMONIALS = [
    { quote: "SpotMe completely changed how I approach training. My coach remembers everything — I never have to repeat context. It's like having a PT in my pocket.", name: 'Sarah M.', role: 'Recreational runner' },
    { quote: "I used the equipment scanner in a hotel gym abroad. It identified a weird cable machine, explained the muscles, and gave me a full circuit in 30 seconds.", name: 'James O.', role: 'Business traveller' },
    { quote: "As a beginner I was intimidated by the gym. SpotMe told me exactly what to do, corrected my form through text, and I've been consistent for 4 months now.", name: 'Priya N.', role: 'First-time gym goer' },
    { quote: "The AI doesn't just repeat the same plan every week. It noticed I mentioned my shoulder was tight and modified the push day without me asking. Wild.", name: 'David C.', role: 'Home gym athlete' },
    { quote: "I've tried every fitness app. This is the first one that actually feels like a conversation, not a form. The responses are fast and surprisingly thoughtful.", name: 'Rachel T.', role: 'CrossFit competitor' },
    { quote: "It remembered that I hate burpees from week one and has never suggested them since. Honestly that alone was worth signing up.", name: 'Marcus C.', role: 'Strength training hobbyist' },
    { quote: "The progress tracking is brutally honest. It told me my squat volume was plateauing and suggested a deload before I even felt tired. Smart stuff.", name: 'Tom V.', role: 'Powerlifting enthusiast' },
    { quote: "I train at odd hours and it's always available. No scheduling, no waiting. I get a full session plan faster than I can change into my gym clothes.", name: 'Anita S.', role: 'Early morning trainer' },
    { quote: "The identify feature is genuinely magic. Pointed it at a leg press machine I'd never used, got muscles, setup cues, weight suggestions — everything.", name: 'Ethan W.', role: 'Gym newcomer' },
    { quote: "What impressed me most is that it doesn't sugarcoat. When I skip rest days it flags the risk. It cares more about my long-term health than my streak.", name: 'Lena H.', role: 'Marathon prep athlete' },
    { quote: "I travel constantly for work. SpotMe adjusts my programme to whatever gym I have access to — bodyweight, hotel gym, full weights. It just adapts.", name: 'Carlos I.', role: 'Frequent traveller' },
    { quote: "My physiotherapist was impressed. I showed her the rehab protocol SpotMe built around my knee injury and she said it aligned with her approach.", name: 'Yemi A.', role: 'Injury recovery' },
  ];

  /* ── Feature card ──────────────────────────────────────── */
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
          <div className="feature-card-bg"
               style={{
                 backgroundImage: `url(${feature.img})`,
                 transform: hovered
                   ? `scale(1.08) translate(${(mousePos.x - 50) * -0.04}%, ${(mousePos.y - 50) * -0.04}%)`
                   : 'scale(1)',
               }} />
          <div className="feature-card-glass" />
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

  /* ── Testimonials ticker ───────────────────────────────── */
  function TestimonialsTicker() {
    const doubled = [...TESTIMONIALS, ...TESTIMONIALS];
    return (
      <div className="testimonials-track-wrap">
        <div className="testimonials-track">
          {doubled.map((t, i) => (
            <div key={i} className="testimonial-card">
              <p className="testimonial-quote">"{t.quote}"</p>
              <div className="testimonial-author">
                <span className="testimonial-name">{t.name}</span>
                <span className="testimonial-role">{t.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Main page ──────────────────────────────────────────── */
  function HomePage({ onGoToLogin, onGoToSignup }) {
    return (
      <div className="marketing-shell" style={{ marginTop: 0, paddingTop: 0 }}>

        {/* ── Pill nav ────────────────────────────────────────── */}
        <nav className="marketing-nav-pill">
          <div className="nav-pill-brand">
            <SpotMeLogo size={28} />
            <span>SpotMe</span>
          </div>
          <div className="nav-pill-links">
            <button type="button" className="nav-pill-link" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</button>
            <button type="button" className="nav-pill-link" onClick={() => document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' })}>Why Us</button>
            <button type="button" className="nav-pill-link" onClick={() => document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' })}>Reviews</button>
          </div>
          <div className="nav-pill-actions">
            <button type="button" className="nav-pill-login" onClick={onGoToLogin}>Log in</button>
            <button type="button" className="nav-pill-cta" onClick={onGoToSignup}>Get started</button>
          </div>
        </nav>

        <div className="marketing-shell-body">

        {/* ── Hero ────────────────────────────────────────────── */}
        <main className="marketing-hero" style={{ paddingTop: 0, marginTop: 0 }}>
          <div className="hero-bg-blur" aria-hidden="true" />
          <div className="hero-orb hero-orb-1" aria-hidden="true" />
          <div className="hero-orb hero-orb-2" aria-hidden="true" />

          <div className="marketing-badge hero-reveal-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>18 programs · All fitness levels</span>
          </div>

          <h1 className="marketing-title hero-reveal-2">
            Train smarter.<br/>
            <span className="marketing-title-accent">Built around you.</span>
          </h1>

          <p className="marketing-sub hero-reveal-3" style={{ marginBottom: 40 }}>
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
        <AnimatedStatsSection />

        {/* ── Features ────────────────────────────────────────── */}
        <section id="features" className="marketing-features-section" style={{ paddingTop: 80 }}>
          <Reveal>
            <SectionLabel>What's Inside</SectionLabel>
            <h2 className="marketing-section-title">
              Everything you need<br/>in one place.
            </h2>
          </Reveal>
          <div className="feature-cards-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} feature={f} delay={i * 80} />
            ))}
          </div>
        </section>

        {/* ── Benefits ────────────────────────────────────────── */}
        <section id="benefits" className="marketing-benefits-section">
          <Reveal>
            <SectionLabel>Benefits</SectionLabel>
            <h2 className="marketing-section-title">Real results, not guesswork.</h2>
          </Reveal>
          <div className="benefits-grid">
            {BENEFITS.map((b, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="benefit-card">
                  <div className="benefit-icon">{b.icon}</div>
                  <h3 className="benefit-title">{b.title}</h3>
                  <p className="benefit-body">{b.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────── */}
        <section className="marketing-how-section">
          <Reveal>
            <SectionLabel>How it works</SectionLabel>
            <h2 className="marketing-section-title">Three steps. Better body.</h2>
          </Reveal>
          <div className="how-steps-row">
            {[
              { num: '01', title: 'Pick your goal', body: 'Muscle, cardio or diet — browse 18 programs and choose the one that fits where you want to be.' },
              { num: '02', title: 'Follow the program', body: 'Step-by-step exercise runner with form cues, muscle diagrams and a built-in rest timer. No thinking required.' },
              { num: '03', title: 'Track and improve', body: 'Review your session history, monitor streaks and body metrics — and let your AI coach refine the plan.' },
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

        {/* ── Integrations ────────────────────────────────────── */}
        <section className="marketing-integrations-section">
          <Reveal>
            <SectionLabel>Integrations</SectionLabel>
            <h2 className="marketing-section-title">Connect effortlessly.</h2>
            <p style={{ color: '#a1a1a1', fontSize: '0.95rem', marginBottom: 48, maxWidth: 540 }}>
              SpotMe syncs with the apps and devices you already use — so your coach always has the full picture.
            </p>
          </Reveal>
          <div className="integrations-grid">
            {INTEGRATIONS.map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="integration-card">
                  <div className="integration-name">{item.name}</div>
                  <div className="integration-body">{item.body}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────────── */}
        <section id="testimonials" className="marketing-testimonials-section">
          <Reveal>
            <div className="testimonials-header">
              <SectionLabel>Testimonials</SectionLabel>
              <h2 className="marketing-section-title">What members are saying.</h2>
            </div>
          </Reveal>
          <TestimonialsTicker />
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

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer>
          <div className="marketing-footer">
            <div className="marketing-footer-brand">
              <SpotMeLogo size={18} />
              <span style={{ color: '#4a4a4a', fontSize: '0.85rem' }}>SpotMe</span>
            </div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <button type="button" style={{ background: 'none', border: 'none', color: '#4a4a4a', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onGoToLogin}>Log in</button>
              <button type="button" style={{ background: 'none', border: 'none', color: '#4a4a4a', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onGoToSignup}>Sign up</button>
              <span className="marketing-footer-note">© 2026 SpotMe</span>
            </div>
          </div>
          <div className="marketing-footer-wordmark" aria-hidden="true">SPOTME</div>
        </footer>

        </div>

      </div>
    );
  }

  SpotMe.HomePage = HomePage;
})();
