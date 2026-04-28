/* ============================================================
   SpotMe — DicterChip + DicterOverlay
   Floating mic button that opens an overlay sheet hosting:
     - Tab "Coach" → existing ChatPage (slim, scoped)
     - Tab "Identify" → existing IdentifyCard
   Replaces the previous chat-as-route paradigm. Chat session state
   lives entirely inside this overlay.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
  const { MicIcon, CloseIcon } = SpotMe.icons;

  /* ---------- Floating chip ---------- */
  function DicterChip({ onOpen, hidden }) {
    if (hidden) return null;
    return (
      <button
        type="button"
        className="fit-dicter"
        onClick={onOpen}
        aria-label="Open Dicter — AI coach and equipment scanner"
      >
        <span className="fit-dicter-mic">
          <span style={{ width: 14, height: 14, display: 'inline-flex' }}>
            <MicIcon />
          </span>
        </span>
        <span>Dicter</span>
        <span className="fit-dicter-kbd">Ctrl</span>
      </button>
    );
  }

  /* ---------- Overlay sheet ---------- */
  function DicterOverlay({ profile, onClose }) {
    const [chatNonce] = useState(0);
    const sheetRef = useRef(null);

    useEffect(() => {
      function esc(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('keydown', esc);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', esc);
        document.body.style.overflow = prev;
      };
    }, [onClose]);

    return (
      <>
        <div className="fit-dicter-backdrop" onClick={onClose} aria-hidden="true" />
        <div
          className="fit-dicter-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Dicter assistant"
          ref={sheetRef}
        >
          <div className="fit-dicter-grip" />
          <div className="fit-dicter-header">
            <span className="fit-dicter-title">SpotMe <span>Coach</span></span>
            <button
              type="button"
              className="fit-dicter-close"
              onClick={onClose}
              aria-label="Close"
            >
              <span style={{ width: 16, height: 16, display: 'inline-flex' }}>
                <CloseIcon />
              </span>
            </button>
          </div>
          <div className="fit-dicter-body">
            {SpotMe.ChatPage && (
              <SpotMe.ChatPage
                key={chatNonce}
                profile={profile}
                initialSession={null}
                onSessionCreated={() => {}}
                embedded
              />
            )}
          </div>
        </div>
      </>
    );
  }

  SpotMe.DicterChip = DicterChip;
  SpotMe.DicterOverlay = DicterOverlay;
})();
