/* ============================================================
   SpotMe — History page
   Search + type dropdown + sort dropdown + three-dot menu
   (rename inline / delete) + preview text.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef, useCallback } = React;
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

  /* Small inline dropdown used for Type and Sort */
  function SelectDropdown({ value, onChange, options }) {
    return (
      <div className="history-select-wrap">
        <select className="history-select" value={value} onChange={e => onChange(e.target.value)}>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="history-select-chevron" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    );
  }

  /* Three-dot menu for a single card */
  function CardMenu({ onRename, onDelete, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
      function outside(e) {
        if (ref.current && !ref.current.contains(e.target)) onClose();
      }
      document.addEventListener('mousedown', outside);
      return () => document.removeEventListener('mousedown', outside);
    }, [onClose]);

    return (
      <div className="card-menu" ref={ref} role="menu">
        <button type="button" role="menuitem" className="card-menu-item" onClick={onRename}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>Rename</span>
        </button>
        <button type="button" role="menuitem" className="card-menu-item card-menu-delete" onClick={onDelete}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          <span>Delete</span>
        </button>
      </div>
    );
  }

  function HistoryPage({ onOpenChat }) {
    const [sessions, setSessions]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [fetchError, setFetchError]   = useState(null);
    const [search, setSearch]           = useState('');
    const [typeFilter, setTypeFilter]   = useState('All');
    const [sortOrder, setSortOrder]     = useState('newest');
    const [openMenu, setOpenMenu]       = useState(null);   // session id
    const [renamingId, setRenamingId]   = useState(null);   // session id being renamed
    const [renameVal, setRenameVal]     = useState('');
    const [renameLoading, setRenameLoading] = useState(false);
    const renameInputRef = useRef(null);

    const load = useCallback(() => {
      setLoading(true);
      setFetchError(null);
      SpotMe.api.listSessions()
        .then(res => {
          if (res.ok) setSessions(res.data.sessions || []);
          else setFetchError('Could not load sessions.');
        })
        .catch(() => setFetchError('Could not reach the server.'))
        .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, []);

    useEffect(() => {
      if (renamingId !== null && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, [renamingId]);

    async function commitRename(id) {
      const title = renameVal.trim();
      if (!title) { setRenamingId(null); return; }
      setRenameLoading(true);
      const r = await SpotMe.api.renameSession(id, title);
      if (r.ok) {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
      }
      setRenamingId(null);
      setRenameVal('');
      setRenameLoading(false);
    }

    async function deleteSession(id) {
      const r = await SpotMe.api.deleteSession(id);
      if (r.ok) setSessions(prev => prev.filter(s => s.id !== id));
      setOpenMenu(null);
    }

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

    const q = search.trim().toLowerCase();
    const filtered = sessions
      .filter(s => {
        if (typeFilter !== 'All') {
          const tags = Array.isArray(s.tags) ? s.tags : (s.tags ? [s.tags] : []);
          if (!tags.some(t => t.toLowerCase() === typeFilter.toLowerCase())) return false;
        }
        if (q) {
          const inTitle   = (s.title   || '').toLowerCase().includes(q);
          const inPreview = (s.preview || '').toLowerCase().includes(q);
          if (!inTitle && !inPreview) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(b.updatedAt) - new Date(a.updatedAt);
        return sortOrder === 'newest' ? diff : -diff;
      });

    return (
      <div className="history-page">
        {/* Header row */}
        <div className="history-header">
          <h2 className="history-title">History</h2>
          <div className="history-header-actions">
            <button type="button" className="profile-row-btn primary"
                    onClick={() => onOpenChat(null)}>
              <PlusIcon /> <span>New Thread</span>
            </button>
          </div>
        </div>

        {/* Toolbar: search + type + sort */}
        <div className="history-toolbar">
          <div className="history-search-wrap">
            <svg className="history-search-icon" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              className="history-search-input"
              placeholder="Search your sessions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="history-search-clear" onClick={() => setSearch('')}
                      aria-label="Clear search">×</button>
            )}
          </div>
          <SelectDropdown
            value={typeFilter}
            onChange={setTypeFilter}
            options={TAG_OPTIONS.map(t => ({ value: t, label: t === 'All' ? 'All types' : t }))}
          />
          <SelectDropdown
            value={sortOrder}
            onChange={setSortOrder}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="history-empty" style={{ margin: '32px auto' }}>
            <h2>{q ? `No results for "${search}"` : `No sessions for "${typeFilter}"`}</h2>
            <p>Try a different filter or start a new conversation.</p>
            <button type="button" className="profile-row-btn"
                    onClick={() => { setSearch(''); setTypeFilter('All'); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="history-cards">
            {filtered.map(session => {
              const isRenaming = renamingId === session.id;
              const menuIsOpen = openMenu === session.id;
              const tags = Array.isArray(session.tags) ? session.tags : (session.tags ? [session.tags] : []);

              return (
                <div key={session.id}
                     className={`history-card${menuIsOpen ? ' menu-open' : ''}`}
                     onClick={() => {
                       if (!isRenaming && !menuIsOpen) onOpenChat(session);
                     }}>
                  {/* Title row */}
                  <div className="history-card-title-row">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        className="history-rename-input"
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  { e.stopPropagation(); commitRename(session.id); }
                          if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null); setRenameVal(''); }
                        }}
                        onClick={e => e.stopPropagation()}
                        disabled={renameLoading}
                        maxLength={120}
                      />
                    ) : (
                      <span className="history-card-title">{session.title || 'Untitled chat'}</span>
                    )}

                    {/* Three-dot button */}
                    <div className="card-menu-wrap" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="card-dots-btn"
                        aria-label="More options"
                        onClick={e => {
                          e.stopPropagation();
                          setOpenMenu(menuIsOpen ? null : session.id);
                        }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                          <circle cx="5"  cy="12" r="1.5"/>
                          <circle cx="12" cy="12" r="1.5"/>
                          <circle cx="19" cy="12" r="1.5"/>
                        </svg>
                      </button>
                      {menuIsOpen && (
                        <CardMenu
                          onRename={() => {
                            setOpenMenu(null);
                            setRenamingId(session.id);
                            setRenameVal(session.title || '');
                          }}
                          onDelete={() => deleteSession(session.id)}
                          onClose={() => setOpenMenu(null)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Preview */}
                  {session.preview && !isRenaming && (
                    <p className="history-card-preview">{session.preview}</p>
                  )}

                  {/* Meta: tags + time */}
                  <div className="history-card-meta">
                    {tags.length > 0 && (
                      <div className="history-card-tags">
                        {tags.map(t => <span key={t} className="history-card-tag">{t}</span>)}
                      </div>
                    )}
                    <span className="history-card-time">{relativeTime(session.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  SpotMe.HistoryPage = HistoryPage;
})();
