/* ============================================================
   SpotMe — History page
   Lists past chat sessions (saved when user starts a new chat).
   In-memory only — wipes on refresh.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { HistoryIcon, SparkleIcon } = SpotMe.icons;

  function HistoryPage({ history, onOpenChat }) {
    if (!history || history.length === 0) {
      return (
        <div className="history-empty">
          <div className="history-empty-icon"><HistoryIcon /></div>
          <h2>No history yet</h2>
          <p>Your past conversations with SpotMe will show up here once you've had a few.</p>
          <button type="button" className="profile-row-btn primary" onClick={onOpenChat}>
            <SparkleIcon /> <span>Start chatting</span>
          </button>
        </div>
      );
    }

    return (
      <div className="history-page">
        <p className="history-hint">Your recent conversations. Click one to re-open (coming soon).</p>
        <ul className="history-list">
          {history.map((entry, i) => (
            <li key={i} className="history-item liquid">
              <div className="history-item-title">{entry.title || 'Untitled chat'}</div>
              <div className="history-item-preview">{entry.preview || ''}</div>
              <div className="history-item-meta">
                {entry.messageCount} message{entry.messageCount === 1 ? '' : 's'}
                {entry.when ? ` · ${entry.when}` : ''}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  SpotMe.HistoryPage = HistoryPage;
})();
