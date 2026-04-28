/* ============================================================
   SpotMe — BookCoachPage
   PRO-only: Schedule a 1-on-1 coaching session.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useCallback } = React;
  const { CalendarIcon, ClockIcon, CrownIcon, ArrowLeftIcon, UserIcon, SparkleIcon } = SpotMe.icons;

  /* ── Mini icons ──────────────────────────────────────────── */
  function TargetIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    );
  }
  function ChatBubbleIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    );
  }
  function ChartIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    );
  }

  /* ── Fake calendar grid (placeholder) ──────────────────────── */
  const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const now    = new Date();
  const y      = now.getFullYear();
  const m      = now.getMonth();
  const today  = now.getDate();

  function buildCalendarDays() {
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  function CalendarPlaceholder({ selected, onSelect }) {
    const cells = buildCalendarDays();
    return (
      <div className="bc-calendar">
        <div className="bc-calendar-header">
          <span className="bc-calendar-month">{MONTH_NAMES[m]} {y}</span>
        </div>
        <div className="bc-calendar-grid">
          {DAYS.map(d => (
            <div key={d} className="bc-calendar-dayname">{d}</div>
          ))}
          {cells.map((d, i) => (
            <button
              key={i}
              type="button"
              disabled={!d || d < today}
              onClick={() => d && d >= today && onSelect(d)}
              className={[
                'bc-calendar-cell',
                !d ? 'bc-calendar-cell--empty' : '',
                d === today ? 'bc-calendar-cell--today' : '',
                d === selected ? 'bc-calendar-cell--selected' : '',
                d && d < today ? 'bc-calendar-cell--past' : '',
              ].join(' ')}>
              {d || ''}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const TIME_SLOTS = ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00'];

  /* ── Toast ─────────────────────────────────────────────────── */
  function Toast({ message, onDone }) {
    React.useEffect(() => {
      const id = setTimeout(onDone, 3000);
      return () => clearTimeout(id);
    }, [onDone]);
    return <div className="bc-toast">{message}</div>;
  }

  /* ── Expect cards ───────────────────────────────────────────── */
  const EXPECT_CARDS = [
    { icon: <TargetIcon />,     title: 'Personalized training plan',
      desc: 'Your coach builds a program around your exact goals, schedule, and fitness level.' },
    { icon: <ChatBubbleIcon />, title: '1-on-1 live coaching chat',
      desc: 'A private session with a certified coach — ask anything, get real answers.' },
    { icon: <ChartIcon />,      title: 'Review your progress & PRs',
      desc: 'Deep dive into your logged workouts, personal records, and areas for improvement.' },
  ];

  /* ── Main page ──────────────────────────────────────────────── */
  function BookCoachPage({ profile, onNavigate }) {
    const isPro = profile && profile.plan === 'pro';

    const [selectedDay,  setSelectedDay]  = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [name,  setName]  = useState(profile ? `${profile.firstName} ${profile.lastName}` : '');
    const [email, setEmail] = useState(profile ? profile.email : '');
    const [notes, setNotes] = useState('');
    const [toast, setToast] = useState('');
    const [booked, setBooked] = useState(false);

    const handleBook = useCallback(() => {
      if (!selectedDay || !selectedTime) {
        setToast('Please select a date and time first.');
        return;
      }
      setToast('🚀 Booking system coming soon — your request has been noted!');
      setBooked(true);
    }, [selectedDay, selectedTime]);

    /* ── Guard: free users → redirect to Plans ── */
    if (!isPro) {
      return (
        <div className="bc-gate">
          <div className="bc-gate-icon"><CrownIcon /></div>
          <h2 className="bc-gate-title">Pro members only</h2>
          <p className="bc-gate-sub">
            Book a 1-on-1 coaching session — available exclusively for SpotMe Pro members.
          </p>
          <button type="button" className="bc-gate-btn"
                  onClick={() => onNavigate && onNavigate('plans')}>
            Upgrade to Pro →
          </button>
        </div>
      );
    }

    return (
      <div className="bc-page">
        {/* Back link */}
        <button type="button" className="bc-back" onClick={() => onNavigate && onNavigate('chat')}>
          <ArrowLeftIcon /> Back to Dashboard
        </button>

        {/* Hero */}
        <div className="bc-hero">
          <div className="bc-pro-badge"><CrownIcon /> PRO</div>
          <h1 className="bc-title">Book a Session with Your Coach</h1>
          <p className="bc-subtitle">
            You're a PRO member — schedule your first 1-on-1 coaching session below.
          </p>
        </div>

        {/* Booking card */}
        <div className="bc-card">
          <div className="bc-card-header">
            <CalendarIcon />
            <div>
              <div className="bc-card-title">Schedule Your Coaching Session</div>
              <div className="bc-card-sub">
                Choose a date and time that works for you. Your personal coach will be ready.
              </div>
            </div>
          </div>

          {/* Date + time */}
          <div className="bc-datetime-row">
            <div className="bc-section">
              <div className="bc-section-label"><CalendarIcon /> Select a date</div>
              <CalendarPlaceholder selected={selectedDay} onSelect={setSelectedDay} />
            </div>
            <div className="bc-section">
              <div className="bc-section-label"><ClockIcon /> Select a time</div>
              <div className="bc-time-grid">
                {TIME_SLOTS.map(slot => (
                  <button key={slot} type="button"
                          className={`bc-time-slot${selectedTime === slot ? ' bc-time-slot--selected' : ''}`}
                          onClick={() => setSelectedTime(slot)}>
                    {slot}
                  </button>
                ))}
              </div>
              {selectedDay && selectedTime && (
                <div className="bc-selection-summary">
                  📅 {MONTH_NAMES[m]} {selectedDay} at {selectedTime}
                </div>
              )}
            </div>
          </div>

          {/* Contact fields */}
          <div className="bc-fields">
            <div className="bc-field-row">
              <div className="bc-field">
                <label className="bc-label">Full name</label>
                <input className="bc-input" type="text" value={name}
                       onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="bc-field">
                <label className="bc-label">Email</label>
                <input className="bc-input" type="email" value={email}
                       onChange={e => setEmail(e.target.value)} placeholder="Your email" />
              </div>
            </div>
            <div className="bc-field">
              <label className="bc-label">Goal / Notes</label>
              <textarea className="bc-textarea" rows="4" value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="What would you like to work on? e.g. lose weight, build muscle, fix my squat..." />
            </div>
          </div>

          <button type="button" className="bc-confirm-btn" onClick={handleBook} disabled={booked}>
            {booked ? '✓ Request received' : 'Confirm Booking'}
          </button>
        </div>

        {/* What to expect */}
        <div className="bc-expect">
          <h2 className="bc-expect-title">What to expect in your session</h2>
          <div className="bc-expect-grid">
            {EXPECT_CARDS.map((c, i) => (
              <div key={i} className="bc-expect-card">
                <div className="bc-expect-icon">{c.icon}</div>
                <div className="bc-expect-card-title">{c.title}</div>
                <div className="bc-expect-card-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast} onDone={() => setToast('')} />}
      </div>
    );
  }

  SpotMe.BookCoachPage = BookCoachPage;
})();
