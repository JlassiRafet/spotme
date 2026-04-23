/* ============================================================
   SpotMe — History page
   Tag filter + sort + clickable cards.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect } = React;
  const { HistoryIcon, SparkleIcon, PlusIcon } = SpotMe.icons;

  const TAG_OPTIONS = ['All', 'Legs', 'Biceps', 'Chest', 'Back', 'Shoulders', 'Arms', 'Upper Body', 'Lower Body', 'Full Body', 'Cardio'];

  function relativeTime(dateVal) {
    if (!dateVal) return '';
    const diff = Date.now() - new Date(dateVal).getTime();
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
    const [activeTag, setActiveTag] = useState('All');
    const [sortOrder, setSortOrder] = useState('newest');

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setFetchError(null);
      SpotMe.api.listSessions()
        .then(res => {
          if (cancelled) return;
          if (res.ok) setSessions(res.data.sessions || []);
          else setFetchError('Could not load sessions. Please try again later.');
        })
        .catch(() => {
          if (!cancelled) setFetchError('Could not reach the server. Check your connection.');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
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

    const filtered = sessions
      .filter(s => {
        if (activeTag === 'All') return true;
        return (s.tags || []).some(t => t.toLowerCase() === activeTag.toLowerCase());
      })
      .sort((a, b) => {
        const diff = new Date(b.updatedAt) - new Date(a.updatedAt);
        return sortOrder === 'newest' ? diff : -diff;
      });

    return (
      <div className="history-page">
        <div className="history-header">
          <h2 className="history-title">History</h2>
          <div className="history-header-actions">
            <button type="button" className="history-sort-btn"
                    onClick={() => setSortOrder(v => v === 'newest' ? 'oldest' : 'newest')}>
              {sortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
            </button>
            <button type="button" className="profile-row-btn primary"
                    onClick={() => onOpenChat(null)}>
              <PlusIcon /> <span>New Thread</span>
            </button>
          </div>
        </div>

        <div className="history-tag-filters">
          {TAG_OPTIONS.map(tag => (
            <button key={tag} type="button"
                    className={`history-tag-chip${activeTag === tag ? ' is-active' : ''}`}
                    onClick={() => setActiveTag(tag)}>
              {tag}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="history-empty" style={{ margin: '32px auto' }}>
            <h2>No sessions for "{activeTag}"</h2>
            <p>Try a different filter or start a new conversation.</p>
            <button type="button" className="profile-row-btn" onClick={() => setActiveTag('All')}>
              Show all
            </button>
          </div>
        ) : (
          <div className="history-cards">
            {filtered.map(session => (
              <div key={session.id} className="history-card"
                   role="button" tabIndex={0}
                   onClick={() => onOpenChat(session)}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChat(session); } }}>
                <div className="history-card-title">{session.title || 'Untitled chat'}</div>
                <div className="history-card-meta">
                  {(session.tags || []).length > 0 && (
                    <div className="history-card-tags">
                      {session.tags.map(t => <span key={t} className="history-card-tag">{t}</span>)}
                    </div>
                  )}
                  <span className="history-card-time">{relativeTime(session.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  SpotMe.HistoryPage = HistoryPage;
})();
