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
    SpotMeLogo, PlusIcon, MicIcon, SendIcon,
    CameraIcon, ImageIcon
  } = SpotMe.icons;

  /* ------------------------------------------------------------
     Pre-made workouts shown in the empty-state carousel.
     Each card has a title, subtitle, a color theme (for the
     gradient) and a short "starter prompt" that gets prefilled
     into the chat input if the user clicks the card.
     ------------------------------------------------------------ */

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
    const wrapRef = useRef(null);
    const [listening,    setListening]    = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef        = useRef([]);
    const streamRef        = useRef(null);

    const voiceSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    const toggleVoice = useCallback(async () => {
      if (transcribing) return;

      // ── Stop ───────────────────────────────────────────────────
      if (listening) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        return;
      }

      // ── Start ──────────────────────────────────────────────────
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        console.warn('[voice] Mic access denied');
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstart = () => setListening(true);

      mr.onstop = async () => {
        setListening(false);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const chunks = chunksRef.current;
        if (!chunks.length) return;

        setTranscribing(true);
        try {
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          const fd   = new FormData();
          fd.append('audio', blob, 'recording.webm');

          const token = localStorage.getItem('spotme.token');
          const resp  = await fetch('/api/transcribe', {
            method:  'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body:    fd
          });
          const json = await resp.json();
          if (json.text) {
            const base = value || '';
            const sep  = base && !base.endsWith(' ') ? ' ' : '';
            onChange(base + sep + json.text);
          }
        } catch (err) {
          console.warn('[voice] Transcription error:', err);
        } finally {
          setTranscribing(false);
          setTimeout(() => taRef.current?.focus(), 60);
        }
      };

      mr.start();
    }, [listening, transcribing, value, onChange]);

    // Cleanup on unmount
    useEffect(() => () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

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

    // Paste image from clipboard
    useEffect(() => {
      const el = taRef.current;
      if (!el) return;
      const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = (ev) => onAttach({ name: file.name || 'pasted-image.png', size: file.size, dataUrl: ev.target.result });
            reader.readAsDataURL(file);
          }
        }
      };
      el.addEventListener('paste', handlePaste);
      return () => el.removeEventListener('paste', handlePaste);
    }, [onAttach]);

    // Drag-and-drop image onto the input box
    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const prevent = (e) => e.preventDefault();
      const handleDrop = (e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (!files) return;
        for (const file of files) {
          if (!file.type.startsWith('image/')) continue;
          const reader = new FileReader();
          reader.onload = (ev) => onAttach({ name: file.name, size: file.size, dataUrl: ev.target.result });
          reader.readAsDataURL(file);
        }
      };
      el.addEventListener('dragover', prevent);
      el.addEventListener('drop', handleDrop);
      return () => {
        el.removeEventListener('dragover', prevent);
        el.removeEventListener('drop', handleDrop);
      };
    }, [onAttach]);

    const submit = () => {
      const v = (value || '').trim();
      if (!v || disabled) return;
      onSend(v);
    };

    return (
      <div className="chat-input liquid" ref={wrapRef}>
        {/* Attachment preview — above the text row */}
        {attachments && attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((a, i) => (
              <span key={i} className="chat-attachment">
                {a.dataUrl && a.dataUrl.startsWith('data:image/') ? (
                  <img src={a.dataUrl} alt={a.name} className="chat-attachment-thumb" />
                ) : (
                  <ImageIcon />
                )}
                <span>{a.name}</span>
                <button type="button" onClick={() => onRemoveAttachment(i)} aria-label="Remove">×</button>
              </span>
            ))}
          </div>
        )}
        {/* Input row: + | textarea | mic + send — all inline */}
        <div className="chat-input-row">
          <PlusMenu onAttach={onAttach} />
          <textarea
            ref={taRef}
            className={`chat-input-textarea${listening ? ' is-listening' : ''}`}
            placeholder={listening ? 'Recording…' : transcribing ? 'Transcribing…' : 'Ask anything…'}
            value={value}
            onChange={e => { if (!listening && !transcribing) onChange(e.target.value); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
          />
          <div className="chat-input-actions">
            <button
              type="button"
              className={`icon-btn mic-btn${(listening || transcribing) ? ' is-recording' : ''}${!voiceSupported ? ' is-disabled' : ''}`}
              aria-label={(listening || transcribing) ? 'Stop recording' : 'Voice input'}
              title={!voiceSupported ? 'Voice not supported in this browser' : listening ? 'Tap to stop' : transcribing ? 'Transcribing…' : 'Voice input'}
              onClick={toggleVoice}
              disabled={!voiceSupported || transcribing}
            >
              <MicIcon />
              {(listening || transcribing) && <span className="mic-pulse-ring" aria-hidden="true" />}
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

        {/* Voice status bar — slides in when recording or transcribing */}
        {(listening || transcribing) && (
          <div className="voice-status-bar">
            <span className="voice-waveform" aria-hidden="true">
              <span /><span /><span /><span /><span />
            </span>
            <span className="voice-status-text">
              {transcribing
                ? <span className="voice-idle">Transcribing…</span>
                : <span className="voice-idle">Recording — tap Stop when done</span>
              }
            </span>
            {listening && (
              <button type="button" className="voice-stop-btn" onClick={toggleVoice} aria-label="Stop recording">
                Stop
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------
     Message — a single user or assistant bubble.
     Handles text chat, image thumbnails, and IdentifyCard results.
     ------------------------------------------------------------ */
  function Message({ role, content, streaming, imageDataUrl, identification }) {
    const { useMemo } = React;

    const html = useMemo(() => {
      if (!content || streaming || !window.marked) return null;
      try {
        return window.marked.parse(content, { breaks: true, gfm: true });
      } catch { return null; }
    }, [content, streaming]);

    if (role === 'user') {
      return (
        <div className="msg msg-user">
          {imageDataUrl && (
            <img src={imageDataUrl} alt="Uploaded" className="msg-user-image" />
          )}
          {content && <div className="msg-bubble">{content}</div>}
        </div>
      );
    }

    // Identify result — show rich card
    if (identification) {
      return SpotMe.IdentifyCard
        ? <SpotMe.IdentifyCard ident={identification} />
        : null;
    }

    // Identify loading state
    if (streaming && !content) {
      return (
        <div className="msg msg-assistant">
          <div className="msg-avatar"><SpotMeLogo size={26} /></div>
          <div className="msg-body">
            <div className="msg-role">SpotMe Coach</div>
            <div className="msg-content">
              Analyzing equipment<span className="msg-cursor" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="msg msg-assistant">
        <div className="msg-avatar"><SpotMeLogo size={26} /></div>
        <div className="msg-body">
          <div className="msg-role">SpotMe Coach</div>
          {html ? (
            <div className="msg-content md-content"
                 dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="msg-content">
              {content}
              {streaming && <span className="msg-cursor" />}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------
     The page itself.
     ------------------------------------------------------------ */
  function ChatPage({ profile, initialSession, onSessionCreated }) {
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
      setInput('');
      setAttachments([]);
      setSending(true);
      setError(null);

      /* ── Image attached → identify endpoint ─────────────────── */
      if (imageDataUrl) {
        setMessages(m => [...m,
          { role: 'user', content: text || '', imageDataUrl },
          { role: 'assistant', content: '', streaming: true }
        ]);
        SpotMe.api.identify({ sessionId: sessionId || undefined, imageDataUrl })
          .then(r => {
            if (r.ok) {
              setSessionId(r.data.sessionId);
              if (onSessionCreated) onSessionCreated();
              setMessages(m => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last && last.streaming) {
                  copy[copy.length - 1] = { ...last, streaming: false, identification: r.data.identification };
                }
                return copy;
              });
            } else {
              setMessages(m => {
                const copy = [...m];
                if (copy[copy.length - 1]?.streaming) copy.pop();
                return copy;
              });
              setError(r.error || 'Could not identify the equipment. Try a clearer photo.');
            }
          })
          .catch(() => {
            setMessages(m => {
              const copy = [...m];
              if (copy[copy.length - 1]?.streaming) copy.pop();
              return copy;
            });
            setError('Could not reach the server.');
          })
          .finally(() => setSending(false));
        return;
      }

      /* ── Text only → streaming chat ─────────────────────────── */
      setMessages(m => [...m, { role: 'user', content: text }]);

      // Append a placeholder assistant message we'll stream into.
      setMessages(m => [...m, { role: 'assistant', content: '', streaming: true }]);

      const ctrl = SpotMe.api.streamChat({
        sessionId: sessionId || undefined,
        message: text,
        imageDataUrl,
        onSession: (id) => {
          setSessionId(id);
          if (onSessionCreated) onSessionCreated();
        },
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
          setMessages(m => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.streaming) {
              if (last.content) {
                copy[copy.length - 1] = { ...last, streaming: false };
              } else {
                copy.pop();
              }
            }
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
              <h1 className="chat-empty-title">SpotMe <span>Coach</span></h1>
            </div>
            <p style={{ textAlign: 'center', opacity: 0.6 }}>Loading session…</p>
          </div>
        ) : empty ? (
          <div className="chat-empty">
            <div className="chat-empty-brand">
              <h1 className="chat-empty-title">SpotMe <span>Coach</span></h1>
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
          </div>
        ) : (
          <>
            <div className="chat-thread" ref={threadRef}>
              {messages.map((m, i) => (
                <Message key={i} role={m.role} content={m.content}
                         streaming={!!m.streaming}
                         imageDataUrl={m.imageDataUrl}
                         identification={m.identification} />
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
})();
