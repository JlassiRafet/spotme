/* ============================================================
   SpotMe — History page
   Lists past chat sessions fetched from the backend.
   Allows reopening a session by clicking the Open button.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect } = React;
  const { HistoryIcon, SparkleIcon } = SpotMe.icons;

  /* Returns a human-readable relative time string, e.g. "2h ago". */
  function relativeTime(dateString) {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  function HistoryPage({ onOpenChat }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setFetchError(null);
      SpotMe.api.listSessions()
        .then(res => {
          if (cancelled) return;
          if (res.ok) {
            setSessions(res.data.sessions || []);
          } else {
            setFetchError('Could not load sessions. Please try again later.');
          }
        })
        .catch(() => {
          if (!cancelled) setFetchError('Could not reach the server. Check your connection.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, []);

    if (loading) {
      return (
        <div className="history-empty">
          <div className="history-empty-icon"><HistoryIcon /></div>
          <h2>Loading…</h2>
          <p>Fetching your past conversations.</p>
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className="history-empty">
          <div className="history-empty-icon"><HistoryIcon /></div>
          <h2>No history available</h2>
          <p>{fetchError}</p>
          <button type="button" className="profile-row-btn primary" onClick={() => onOpenChat(null)}>
            <SparkleIcon /> <span>Start chatting</span>
          </button>
        </div>
      );
    }

    if (sessions.length === 0) {
      return (
        <div className="history-empty">
          <div className="history-empty-icon"><HistoryIcon /></div>
          <h2>No history yet</h2>
          <p>Your past conversations with SpotMe will show up here once you've had a few.</p>
          <button type="button" className="profile-row-btn primary" onClick={() => onOpenChat(null)}>
            <SparkleIcon /> <span>Start chatting</span>
          </button>
        </div>
      );
    }

    return (
      <div className="history-page">
        <p className="history-hint">Your recent conversations. Click Open to continue one.</p>
        <ul className="history-list">
          {sessions.map((session) => (
            <li key={session.id} className="history-item liquid">
              <div className="history-item-title">{session.title || 'Untitled chat'}</div>
              <div className="history-item-meta">
                {session.tags && session.tags.length > 0
                  ? session.tags.join(', ') + ' · '
                  : ''}
                {relativeTime(session.updatedAt)}
              </div>
              <button
                type="button"
                className="profile-row-btn"
                onClick={() => onOpenChat(session)}
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  SpotMe.HistoryPage = HistoryPage;
})();
