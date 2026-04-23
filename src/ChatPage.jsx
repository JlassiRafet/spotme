/* ============================================================
   SpotMe — ChatPage
   Empty state: big "SpotMe" wordmark + input box + workout carousel
   Active:     scrolling message thread + input box pinned at bottom
   Replies come from the real Anthropic API (no-API-key call, the
   sandbox routes it). The system prompt tunes Claude to act as a
   fitness coach that knows the user's profile.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef, useCallback } = React;
  const {
    SpotMeLogo, PlusIcon, MicIcon, SendIcon, ChevronIcon,
    CameraIcon, ImageIcon, ArrowLeftIcon, ArrowRightIcon
  } = SpotMe.icons;

  /* ------------------------------------------------------------
     Pre-made workouts shown in the empty-state carousel.
     Each card has a title, subtitle, a color theme (for the
     gradient) and a short "starter prompt" that gets prefilled
     into the chat input if the user clicks the card.
     ------------------------------------------------------------ */
  const WORKOUTS = [
    { title: 'Push Day',  sub: 'Chest · Shoulders · Triceps',
      colorA: '#5c8cff', colorB: '#7b55ff',
      prompt: 'Give me a 45-minute push day (chest, shoulders, triceps) for my experience level.' },
    { title: 'Pull Day',  sub: 'Back · Biceps · Rear Delts',
      colorA: '#3ea9ff', colorB: '#2fd1c4',
      prompt: 'Plan a 45-minute pull day (back, biceps) with two finisher options.' },
    { title: 'Leg Day',   sub: 'Quads · Hams · Glutes',
      colorA: '#ff7a5c', colorB: '#ff3d8f',
      prompt: 'Build me a leg day that balances quad- and posterior-chain work.' },
    { title: 'Chest Focus', sub: 'Hypertrophy block',
      colorA: '#7ab3ff', colorB: '#3d6dff',
      prompt: 'Give me a chest-focused hypertrophy session with two horizontal and two incline movements.' },
    { title: 'Full Body', sub: '40 min · Express',
      colorA: '#9b7bff', colorB: '#4aa3ff',
      prompt: 'Design a 40-minute full-body session covering squat, hinge, push, pull.' },
    { title: 'Cardio + Core', sub: 'Conditioning',
      colorA: '#52d4a3', colorB: '#3d8bff',
      prompt: 'Give me a 30-minute cardio + core circuit with three rounds.' }
  ];

  function WorkoutCarousel({ onPick }) {
    // Shows 3 cards side-by-side at a time. Auto-rotates every 3.8s,
    // pauses on hover. Arrows nav manually. The index is the LEFTMOST
    // visible card; we show [index, index+1, index+2] modulo length.
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const total = WORKOUTS.length;

    useEffect(() => {
      if (paused) return;
      const t = setInterval(() => setIndex(i => (i + 1) % total), 3800);
      return () => clearInterval(t);
    }, [paused, total]);

    const next = () => setIndex(i => (i + 1) % total);
    const prev = () => setIndex(i => (i - 1 + total) % total);

    // Build an ordered list starting from `index` so the layout doesn't
    // jump when we wrap.  We render all cards and translate the row.
    return (
      <div className="workout-carousel"
           onMouseEnter={() => setPaused(true)}
           onMouseLeave={() => setPaused(false)}>
        <button type="button" className="carousel-arrow prev" onClick={prev}
                aria-label="Previous workout"><ArrowLeftIcon /></button>
        <div className="carousel-viewport">
          <div className="carousel-track"
               style={{ transform: `translateX(calc(-${index} * (var(--card-w) + var(--card-gap))))` }}>
            {WORKOUTS.map((w, i) => (
              <button type="button" key={i} className="workout-card liquid"
                      onClick={() => onPick(w.prompt)}
                      style={{
                        '--card-a': w.colorA,
                        '--card-b': w.colorB
                      }}>
                <span className="workout-card-glow" />
                <div className="workout-card-label">Pre-made · Workout</div>
                <div className="workout-card-title">{w.title}</div>
                <div className="workout-card-sub">{w.sub}</div>
                <div className="workout-card-cta">
                  <span>Try it</span>
                  <ArrowRightIcon />
                </div>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="carousel-arrow next" onClick={next}
                aria-label="Next workout"><ArrowRightIcon /></button>
        <div className="carousel-dots" role="tablist" aria-label="Workout selection">
          {WORKOUTS.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === index}
                    className={`carousel-dot${i === index ? ' is-active' : ''}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to workout ${i + 1}`} />
          ))}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------
     PlusMenu — the "+" menu that opens from inside the chat input.
     Options: Upload files, Take picture, Connectors. "Take picture"
     uses <input capture="user"> to trigger the device camera where
     supported (falls back to file picker elsewhere).
     ------------------------------------------------------------ */
  function PlusMenu({ onAttach }) {
    const [open, setOpen] = useState(false);
    const uploadRef = useRef(null);
    const cameraRef = useRef(null);
    const rootRef = useRef(null);
    useEffect(() => {
      function outside(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
      function esc(e) { if (e.key === 'Escape') setOpen(false); }
      document.addEventListener('click', outside);
      document.addEventListener('keydown', esc);
      return () => {
        document.removeEventListener('click', outside);
        document.removeEventListener('keydown', esc);
      };
    }, []);

    const handlePicked = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) onAttach({ name: file.name, size: file.size });
      setOpen(false);
    };

    return (
      <div className="relative-wrap" ref={rootRef}>
        <button type="button" className="plus-btn" onClick={() => setOpen(o => !o)}
                aria-label="Attach"><PlusIcon /></button>
        {open && (
          <div className="plus-menu" role="menu">
            <button type="button" role="menuitem" className="plus-menu-item"
                    onClick={() => uploadRef.current && uploadRef.current.click()}>
              <ImageIcon /> <span>Upload files or images</span>
            </button>
            <button type="button" role="menuitem" className="plus-menu-item"
                    onClick={() => cameraRef.current && cameraRef.current.click()}>
              <CameraIcon /> <span>Take a picture</span>
            </button>
            <input ref={uploadRef} type="file" accept="image/*,.pdf"
                   style={{ display: 'none' }} onChange={handlePicked} />
            <input ref={cameraRef} type="file" accept="image/*" capture="user"
                   style={{ display: 'none' }} onChange={handlePicked} />
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------
     ChatInput — the big rounded input at the bottom (or center
     in the empty state). Handles text + send + attach + model
     pill + mic placeholder.
     ------------------------------------------------------------ */
  function ChatInput({ value, onChange, onSend, attachments, onAttach, onRemoveAttachment, disabled, autoFocus }) {
    const taRef = useRef(null);
    useEffect(() => {
      if (autoFocus && taRef.current) taRef.current.focus();
    }, [autoFocus]);

    // Auto-resize textarea up to a max height
    useEffect(() => {
      const el = taRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, [value]);

    const submit = () => {
      const v = (value || '').trim();
      if (!v || disabled) return;
      onSend(v);
    };

    return (
      <div className="chat-input liquid">
        <textarea
          ref={taRef}
          className="chat-input-textarea"
          placeholder="Ask anything…"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
        />
        {attachments && attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((a, i) => (
              <span key={i} className="chat-attachment">
                <ImageIcon /> <span>{a.name}</span>
                <button type="button" onClick={() => onRemoveAttachment(i)} aria-label="Remove">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <div className="chat-input-left">
            <PlusMenu onAttach={onAttach} />
            <button type="button" className="model-pill" aria-label="Model">
              <span className="model-pill-dot" />
              <span>SpotMe Coach</span>
              <ChevronIcon />
            </button>
          </div>
          <div className="chat-input-right">
            <span className="model-name">Claude Sonnet 4.6 · Thinking</span>
            <button type="button" className="icon-btn" aria-label="Voice input" title="Voice (coming soon)">
              <MicIcon />
            </button>
            <button type="button"
                    className={`send-btn${value.trim() ? ' is-ready' : ''}`}
                    onClick={submit}
                    disabled={disabled || !value.trim()}
                    aria-label="Send message">
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------
     Message — a single user or assistant bubble.
     ------------------------------------------------------------ */
  function Message({ role, content, streaming }) {
    if (role === 'user') {
      return (
        <div className="msg msg-user">
          <div className="msg-bubble">{content}</div>
        </div>
      );
    }
    return (
      <div className="msg msg-assistant">
        <div className="msg-avatar"><SpotMeLogo size={26} /></div>
        <div className="msg-body">
          <div className="msg-role">SpotMe Coach</div>
          <div className="msg-content">
            {content}
            {streaming && <span className="msg-cursor" />}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------
     Canned-reply fallback library.

     The real Claude API works when this app is loaded as a Claude
     Artifact (the sandbox injects auth). When hosted elsewhere
     (local dev server, static host without a proxy, offline demo),
     the browser blocks the call at CORS. Instead of surfacing an
     error there, we match the user's message against a small set
     of keyword rules and return a plausible coach-style reply.
     The real API is always tried first; fallback only fires when
     it actually fails.
     ------------------------------------------------------------ */
  const CANNED_REPLIES = [
    {
      keys: ['warmup', 'warm up', 'warm-up'],
      reply: (p) => `A quick warm-up for a push day, tailored to a ${p.level || 'general'} lifter:

1. 60s light row or bike (get your breathing up)
2. Arm circles, 10 each direction
3. Band pull-aparts x 15
4. Wall slides x 10
5. Push-up to down-dog x 8

That's it — you're warm without burning energy you'll need for the working sets.`
    },
    {
      keys: ['push day', 'push workout', 'chest'],
      reply: (p) => `Push day, tuned for ${p.level || 'intermediate'}:

• Bench press — 4 x 6–8
• Incline DB press — 3 x 8–10
• Seated overhead press — 3 x 8
• Lateral raise — 3 x 12–15
• Tricep pushdown — 3 x 10–12
• Rope overhead extension — 2 x 12

Rest 90s on compounds, 60s on the rest. Push the last set of each.`
    },
    {
      keys: ['pull day', 'pull workout', 'back'],
      reply: (p) => `Pull day:

• Deadlift — 4 x 5 (work up to a hard top set)
• Pull-ups or lat pulldown — 4 x 6–10
• Chest-supported row — 3 x 10
• Face pulls — 3 x 15
• Barbell curl — 3 x 8
• Hammer curl — 2 x 12

If deadlifts feel heavy today, drop to 3 x 5 at 80% and keep moving.`
    },
    {
      keys: ['leg day', 'leg workout', 'quad', 'squat'],
      reply: (p) => `Leg day:

• Back squat — 4 x 5
• Romanian deadlift — 3 x 8
• Walking lunge — 3 x 10 each leg
• Leg curl — 3 x 12
• Calf raise — 4 x 12–15

Balanced quad + posterior chain. Don't skip the RDLs — they carry most of your strength.`
    },
    {
      keys: ['cardio', 'conditioning'],
      reply: () => `30-minute cardio + core circuit, 3 rounds:

• 3 min zone-2 bike/row
• 30s plank
• 15 Russian twists each side
• 10 mountain climbers each side
• 60s rest

Keep the bike/row easy. This is conditioning, not a grinder.`
    },
    {
      keys: ['rest', 'recovery', 'sore'],
      reply: () => `If you're sore, you have three good options:

1. Active recovery — 20 min easy walk or bike, mobility for 10 min
2. Deload — same lifts but 60% of your normal weight, 3 sets of 5
3. Full rest — take the day, hydrate, sleep 8+

Soreness that lasts past 48h usually means volume was too high, not that you need to push through.`
    }
  ];

  function cannedReply(userText, profile) {
    const q = (userText || '').toLowerCase();
    const match = CANNED_REPLIES.find(rule => rule.keys.some(k => q.includes(k)));
    if (match) return match.reply(profile);
    // Generic fallback
    const name = profile.firstName || 'there';
    return `Hey ${name} — I'm running in demo mode right now (the live API isn't reachable from this environment), but here's the idea:

Based on your profile (${profile.level || 'unspecified level'}, goal: ${profile.trainingGoal || 'general fitness'}), I'd normally build you a specific session around: "${userText.slice(0, 80)}".

Try a prompt like "push day" or "warmup" to see a real canned example. When this is deployed as a Claude Artifact, every reply will come live from Claude.`;
  }

  /* ------------------------------------------------------------
     Real Claude API call. Builds messages[] from our local state,
     attaches a system prompt tuned to the user's profile, and hits
     /v1/messages. No API key — the Claude artifact sandbox injects
     it at runtime. When this app is hosted elsewhere the call fails
     at CORS and we fall through to cannedReply() above.
     ------------------------------------------------------------ */
  async function callClaude({ messages, profile }) {
    const systemPrompt = [
      "You are SpotMe Coach — a concise, friendly AI personal trainer and fitness companion inside the SpotMe app.",
      "You write in clear, encouraging language, use short paragraphs, and use bullet lists or numbered steps when prescribing workouts.",
      "Always tailor recommendations to the user's profile below. If the user asks something unrelated to fitness or wellbeing, answer briefly and steer back to their training.",
      "",
      "User profile:",
      `- Name: ${profile.firstName || 'Athlete'} ${profile.lastName || ''}`.trim(),
      `- Experience level: ${profile.level || 'unspecified'}`,
      `- Weight: ${profile.weight ? `${profile.weight} ${profile.weightUnit}` : 'unspecified'}`,
      `- Height: ${profile.height ? `${profile.height} ${profile.heightUnit}` : 'unspecified'}`,
      profile.playsSport === 'Yes' && profile.sportName ? `- Plays: ${profile.sportName}` : null,
      profile.trainingGoal ? `- Primary training goal: ${profile.trainingGoal}` : null
    ].filter(Boolean).join('\n');

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    return text || '(No response.)';
  }

  /* ------------------------------------------------------------
     The page itself.
     ------------------------------------------------------------ */
  function ChatPage({ profile, initialSession }) {
    const [messages, setMessages] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);
    const [error, setError] = useState(null);
    const threadRef = useRef(null);

    const empty = messages.length === 0 && !loadingSession;

    // Restore a previous session on mount if initialSession is provided
    useEffect(() => {
      if (!initialSession) return;
      let cancelled = false;
      setLoadingSession(true);
      setError(null);
      SpotMe.api.getSession(initialSession.id)
        .then(res => {
          if (cancelled) return;
          if (res.ok) {
            setSessionId(res.data.session.id || initialSession.id);
            setMessages(
              (res.data.messages || []).map(m => ({
                role: m.role,
                content: m.content
              }))
            );
          } else {
            setError('Could not load the session. Starting fresh.');
          }
        })
        .catch(() => {
          if (!cancelled) setError('Could not reach the server. Starting fresh.');
        })
        .finally(() => {
          if (!cancelled) setLoadingSession(false);
        });
      return () => { cancelled = true; };
    // eslint-disable-next-line
    }, []);

    // Scroll to bottom on new message
    useEffect(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [messages, sending, loadingSession]);

    const send = useCallback(async (text) => {
      if (sending) return;
      const nextMessages = [...messages, { role: 'user', content: text }];
      setMessages(nextMessages);
      setInput('');
      setAttachments([]);
      setSending(true);
      setError(null);
      try {
        const reply = await callClaude({ messages: nextMessages, profile });
        setMessages(m => [...m, { role: 'assistant', content: reply }]);
      } catch (e) {
        // Live API unreachable (CORS, offline, no key, etc.) — use the
        // keyword-matched canned-reply library so the chat is still
        // functional as a demo.
        console.warn('Live API unavailable, using canned reply:', e.message);
        const reply = cannedReply(text, profile);
        setMessages(m => [...m, { role: 'assistant', content: reply }]);
      } finally {
        setSending(false);
      }
    }, [messages, profile, sending]);

    const addAttachment = (a) => setAttachments(prev => [...prev, a]);
    const removeAttachment = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

    return (
      <div className="chat-page">
        {loadingSession ? (
          <div className="chat-empty">
            <div className="chat-empty-brand">
              <SpotMeLogo size={44} />
              <h1 className="chat-empty-title">spotme <span>coach</span></h1>
            </div>
            <p style={{ textAlign: 'center', opacity: 0.6 }}>Loading session…</p>
          </div>
        ) : empty ? (
          <div className="chat-empty">
            <div className="chat-empty-brand">
              <SpotMeLogo size={44} />
              <h1 className="chat-empty-title">spotme <span>coach</span></h1>
            </div>
            <div className="chat-empty-input">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={send}
                attachments={attachments}
                onAttach={addAttachment}
                onRemoveAttachment={removeAttachment}
                disabled={sending}
                autoFocus
              />
            </div>
            <div className="chat-empty-suggestions">
              <div className="chat-empty-suggestions-label">
                Try a pre-made workout
              </div>
              <WorkoutCarousel onPick={(p) => { setInput(p); send(p); }} />
            </div>
          </div>
        ) : (
          <>
            <div className="chat-thread" ref={threadRef}>
              {messages.map((m, i) => (
                <Message key={i} role={m.role} content={m.content} />
              ))}
              {sending && (
                <Message role="assistant" content="Thinking…" streaming />
              )}
              {error && (
                <div className="chat-error">{error}</div>
              )}
            </div>
            <div className="chat-footer">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={send}
                attachments={attachments}
                onAttach={addAttachment}
                onRemoveAttachment={removeAttachment}
                disabled={sending}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  SpotMe.ChatPage = ChatPage;
  SpotMe.WORKOUTS = WORKOUTS;
})();
