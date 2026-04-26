/* ============================================================
   SpotMe — AboutPage
   Concept, how it works, tech, and vision.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
  const { SpotMeLogo } = SpotMe.icons;

  function useInView(delay) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { setInView(true); obs.disconnect(); }
      }, { threshold: 0.08 });
      obs.observe(el);
      return () => obs.disconnect();
    }, []);
    return [ref, inView, delay || 0];
  }

  function RevealBlock({ children, delay = 0 }) {
    const [ref, inView] = useInView();
    return (
      <div ref={ref} style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}>
        {children}
      </div>
    );
  }

  const HOW_STEPS = [
    {
      num: '01',
      title: 'Chat with your coach',
      body: 'Ask anything — workout plans, form tips, nutrition questions. SpotMe remembers every session so context carries forward.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      num: '02',
      title: 'Identify any machine',
      body: 'Point your camera at gym equipment. AI recognizes it instantly — muscles targeted, step-by-step form, safety notes.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      ),
    },
    {
      num: '03',
      title: 'Track your progress',
      body: 'Every session is saved. Watch your strength curve week over week, hit PRs, and let the AI adapt your next block automatically.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
      ),
    },
  ];

  const TECH_ITEMS = [
    { label: 'AI Engine', value: 'Groq · Llama 3.3 70B', sub: 'Ultra-fast inference, context-aware coaching' },
    { label: 'Vision Model', value: 'Llama 3.2 11B Vision', sub: 'Equipment ID from a single photo' },
    { label: 'Backend', value: 'Node.js · Express · SQLite', sub: 'Lightweight, runs anywhere' },
    { label: 'Auth', value: 'bcrypt · JWT Bearer tokens', sub: 'Secure, stateless authentication' },
  ];

  function AboutPage() {
    return (
      <div className="about-page">

        {/* Hero */}
        <div className="about-hero">
          <RevealBlock delay={0}>
            <div className="marketing-section-tag" style={{ margin: '0 auto 20px' }}>Our story</div>
            <h1 className="about-hero-title">
              AI coaching that<br/>
              <span className="about-accent">actually remembers you.</span>
            </h1>
            <p className="about-hero-sub">
              SpotMe was built from a simple frustration: every AI tool forgets you between sessions.
              Your goals, your injuries, your last workout — gone. SpotMe keeps the full picture.
            </p>
          </RevealBlock>
        </div>

        {/* Concept card */}
        <RevealBlock delay={80}>
          <div className="about-concept-card">
            <div className="about-concept-icon">
              <SpotMeLogo size={36} />
            </div>
            <div>
              <h2 className="about-concept-title">The concept</h2>
              <p className="about-concept-body">
                SpotMe is a personal AI fitness coach that lives on your phone and knows your training history.
                You talk to it like a real coach — describing how you felt, what you hit, what hurts.
                It adapts your next session accordingly. No forms. No spreadsheets. Just a conversation
                that builds on itself, every single day.
              </p>
            </div>
          </div>
        </RevealBlock>

        {/* How it works */}
        <div className="about-section">
          <RevealBlock delay={0}>
            <div className="about-section-label">How it works</div>
          </RevealBlock>
          <div className="about-steps">
            {HOW_STEPS.map((s, i) => (
              <RevealBlock key={i} delay={i * 80}>
                <div className="about-step-card">
                  <div className="about-step-num">{s.num}</div>
                  <div className="about-step-icon">{s.icon}</div>
                  <h3 className="about-step-title">{s.title}</h3>
                  <p className="about-step-body">{s.body}</p>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>

        {/* Tech */}
        <RevealBlock delay={0}>
          <div className="about-section">
            <div className="about-section-label">Under the hood</div>
            <div className="about-tech-grid">
              {TECH_ITEMS.map((t, i) => (
                <div key={i} className="about-tech-card">
                  <div className="about-tech-label">{t.label}</div>
                  <div className="about-tech-value">{t.value}</div>
                  <div className="about-tech-sub">{t.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </RevealBlock>

        {/* Vision */}
        <RevealBlock delay={0}>
          <div className="about-vision-card">
            <div className="about-vision-quote">"</div>
            <p className="about-vision-text">
              The gym is one of the last places where people are still flying blind.
              No real-time feedback, no memory between sessions, no personalisation at scale.
              SpotMe is the first step toward changing that.
            </p>
            <div className="about-vision-author">— SpotMe team</div>
          </div>
        </RevealBlock>

      </div>
    );
  }

  SpotMe.AboutPage = AboutPage;
})();
