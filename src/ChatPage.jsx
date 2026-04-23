/* ============================================================
   SpotMe — ChatPage
   Empty state: big "SpotMe" wordmark + input box + workout carousel
   Active:     scrolling message thread + input box pinned at bottom
   Replies come from SpotMe.api.chat() — the backend server on the
   same origin handles all AI calls.
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
      if (!file) { setOpen(false); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        onAttach({ name: file.name, size: file.size, dataUrl: ev.target.result });
      };
      reader.readAsDataURL(file);
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
    const abortRef = useRef(null);

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

    const send = useCallback((text) => {
      if (sending) return;
      const imageDataUrl = (attachments.find(a => a.dataUrl) || {}).dataUrl || undefined;
      setMessages(m => [...m, { role: 'user', content: text }]);
      setInput('');
      setAttachments([]);
      setSending(true);
      setError(null);

      // Append a placeholder assistant message we'll stream into.
      setMessages(m => [...m, { role: 'assistant', content: '', streaming: true }]);

      const ctrl = SpotMe.api.streamChat({
        sessionId: sessionId || undefined,
        message: text,
        imageDataUrl,
        onSession: (id) => setSessionId(id),
        onChunk: (delta) => {
          setMessages(m => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.streaming) {
              copy[copy.length - 1] = { ...last, content: last.content + delta };
            }
            return copy;
          });
        },
        onDone: () => {
          setMessages(m => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.streaming) {
              copy[copy.length - 1] = { ...last, streaming: false };
            }
            return copy;
          });
          setSending(false);
        },
        onError: (msg) => {
          // Remove the empty streaming bubble, show error banner.
          setMessages(m => {
            const copy = [...m];
            if (copy[copy.length - 1]?.streaming) copy.pop();
            return copy;
          });
          setError(msg || 'Something went wrong. Please try again.');
          setSending(false);
        }
      });
      abortRef.current = ctrl;
    }, [attachments, sending, sessionId]);

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
                <Message key={i} role={m.role} content={m.content} streaming={!!m.streaming} />
              ))}
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
