/* ============================================================
   SpotMe — Settings page (two-panel on desktop, stacked on mobile)
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useRef } = React;
  const { TrashIcon, CameraIcon, LogoutIcon } = SpotMe.icons;

  const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );

  function Toggle({ checked, onChange }) {
    return (
      <button type="button" role="switch" aria-checked={checked}
              className={`settings-toggle${checked ? ' is-on' : ''}`}
              onClick={e => { e.stopPropagation(); onChange(!checked); }}>
        <span className="settings-toggle-thumb" />
      </button>
    );
  }

  function SettingsRow({ label, sub, value, onClick, chevron = true, toggle, onToggle, badge }) {
    const interactive = !!onClick || toggle !== undefined;
    const Tag = interactive ? 'button' : 'div';
    const props = interactive && onClick ? { type: 'button', onClick } : interactive ? { type: 'button' } : {};
    return (
      <Tag {...props} className={`settings-row${interactive ? ' is-interactive' : ''}`}>
        <div className="settings-row-left">
          <span className="settings-row-label">{label}</span>
          {sub && <span className="settings-row-sub">{sub}</span>}
        </div>
        <div className="settings-row-right">
          {value && <span className="settings-row-value">{value}</span>}
          {badge && <span className="settings-badge">{badge}</span>}
          {toggle !== undefined
            ? <Toggle checked={toggle} onChange={onToggle} />
            : (chevron && onClick && <ChevronRight />)}
        </div>
      </Tag>
    );
  }

  function DeleteAccountDialog({ onConfirm, onCancel, busy }) {
    const [input, setInput] = useState('');
    const match = input.trim().toLowerCase() === 'delete my account';
    return (
      <div className="delete-dialog-overlay" role="dialog" aria-modal="true">
        <div className="delete-dialog">
          <h3 className="delete-dialog-title">Delete your account?</h3>
          <p className="delete-dialog-body">
            This permanently removes your profile, all sessions, and all messages. There's no going back.
          </p>
          <p className="delete-dialog-prompt">Type <strong>delete my account</strong> to confirm:</p>
          <input type="text" className="auth-input" value={input}
                 onChange={e => setInput(e.target.value)}
                 placeholder="delete my account" autoFocus disabled={busy} />
          <div className="delete-dialog-actions">
            <button type="button" className="profile-row-btn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className="profile-row-btn danger" onClick={onConfirm} disabled={!match || busy}>
              {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const NAV_SECTIONS = [
    {
      id: 'account', label: 'Account',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
    },
    {
      id: 'app', label: 'App',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="20" y2="12"/>
              <line x1="12" y1="18" x2="20" y2="18"/>
            </svg>
    },
    {
      id: 'about', label: 'About',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
    },
  ];

  function ProfilePage({ profile, onUpdateProfile, onDeleteAccount, onLogout }) {
    const fileInputRef = useRef(null);
    const [activeSection, setActiveSection] = useState('account');
    const [editing, setEditing]             = useState(false);
    const [editName, setEditName]           = useState('');
    const [editUsername, setEditUsername]   = useState('');
    const [spellCheck, setSpellCheck]       = useState(false);
    const [toast, setToast]                 = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleting, setDeleting]           = useState(false);
    const [deleteError, setDeleteError]     = useState('');

    const displayName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    const initials = [profile.firstName, profile.lastName]
      .filter(Boolean).map(s => s.charAt(0).toUpperCase()).join('') || '?';

    function startEdit() { setEditName(displayName); setEditUsername(profile.username || ''); setEditing(true); }
    function cancelEdit() { setEditing(false); }
    function saveEdit() {
      const parts = editName.trim().split(/\s+/);
      const uname = editUsername.trim().toLowerCase().replace(/\s+/g, '');
      onUpdateProfile({ ...profile, firstName: parts[0] || '', lastName: parts.slice(1).join(' '), username: uname });
      setEditing(false);
    }
    function comingSoon() { setToast('Under development'); setTimeout(() => setToast(''), 2200); }
    function handleAvatarChoose(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => onUpdateProfile({ ...profile, avatar: ev.target.result });
      reader.readAsDataURL(file);
    }

    const planLabel = profile.subscription === 'pro' ? 'SpotMe Pro' : 'Free';

    return (
      <div className="settings-layout">

        {/* ── Left nav (hidden on mobile) ── */}
        <nav className="settings-nav">
          <div className="settings-nav-title">Settings</div>
          <div className="settings-nav-items">
            {NAV_SECTIONS.map(s => (
              <button key={s.id} type="button"
                      className={`settings-nav-item${activeSection === s.id ? ' is-active' : ''}`}
                      onClick={() => setActiveSection(s.id)}>
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* ── Right content ── */}
        <div className="settings-content">

          {/* Account panel */}
          <div className={`settings-panel${activeSection === 'account' ? ' is-active' : ''}`}>
            <div className="settings-avatar-section">
              <div className="settings-avatar-outer">
                {editing && (
                  <button type="button" className="settings-avatar-cam-btn"
                          onClick={() => fileInputRef.current && fileInputRef.current.click()}
                          aria-label="Change photo"><CameraIcon /></button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*"
                       onChange={handleAvatarChoose} style={{ display: 'none' }} />
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="settings-avatar-img" />
                  : <div className="settings-avatar-circle"><span className="settings-avatar-initial">{initials}</span></div>}
              </div>
              {editing ? (
                <div className="settings-edit-form">
                  <div className="settings-edit-inputs">
                    <input type="text" className="auth-input" placeholder="Full name"
                           value={editName} onChange={e => setEditName(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                           autoFocus />
                    <input type="text" className="auth-input" placeholder="Username (no spaces)"
                           value={editUsername} onChange={e => setEditUsername(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                  </div>
                  <div className="settings-edit-actions">
                    <button type="button" className="profile-row-btn" onClick={cancelEdit}>Cancel</button>
                    <button type="button" className="profile-row-btn primary" onClick={saveEdit}>Save profile</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="settings-name">{displayName || 'Your name'}</div>
                  <div className="settings-handle">@{profile.username || 'username'}</div>
                  <button type="button" className="settings-edit-btn" onClick={startEdit}>Edit profile</button>
                </>
              )}
            </div>

            <div className="settings-section-label">Account</div>
            <div className="settings-card">
              <SettingsRow label="Email" value={profile.email} chevron={false} />
              <div className="settings-card-divider" />
              <SettingsRow label="Subscription" value={planLabel} chevron={false} />
              <div className="settings-card-divider" />
              <SettingsRow label="Upgrade to SpotMe Pro" onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label="Restore purchases" onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label="Notifications" onClick={comingSoon} badge="Soon" />
              <div className="settings-card-divider" />
              <SettingsRow label="Data Controls" onClick={comingSoon} badge="Soon" />
            </div>

            <div className="settings-bottom-actions">
              {onLogout && (
                <button type="button" className="settings-logout-btn" onClick={onLogout}>
                  <LogoutIcon /> Log out
                </button>
              )}
              <button type="button" className="settings-delete-btn"
                      onClick={() => { setShowDeleteDialog(true); setDeleteError(''); }}>
                <TrashIcon /> Delete account
              </button>
              {deleteError && <p className="auth-error-banner" role="alert">{deleteError}</p>}
            </div>
          </div>

          {/* App panel */}
          <div className={`settings-panel${activeSection === 'app' ? ' is-active' : ''}`}>
            <div className="settings-section-label">App</div>
            <div className="settings-card">
              <SettingsRow label="App language" value="English" onClick={comingSoon} badge="Soon" />
              <div className="settings-card-divider" />
              <SettingsRow label="Appearance" value="System" onClick={comingSoon} badge="Soon" />
              <div className="settings-card-divider" />
              <SettingsRow label="Correct spelling automatically" toggle={spellCheck} onToggle={setSpellCheck} />
            </div>
          </div>

          {/* About panel */}
          <div className={`settings-panel${activeSection === 'about' ? ' is-active' : ''}`}>
            <div className="settings-section-label">About</div>
            <div className="settings-card">
              <SettingsRow label="Report a bug" onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label="Help Center" onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label="Terms of Use" onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label="Privacy Policy" onClick={comingSoon} />
            </div>
          </div>

        </div>

        {toast && <div className="settings-toast">{toast}</div>}

        {showDeleteDialog && (
          <DeleteAccountDialog
            busy={deleting}
            onCancel={() => setShowDeleteDialog(false)}
            onConfirm={async () => {
              setDeleting(true);
              setDeleteError('');
              const r = await onDeleteAccount();
              setDeleting(false);
              if (!r.ok) { setShowDeleteDialog(false); setDeleteError(r.error || 'Could not delete account. Try again.'); }
            }}
          />
        )}
      </div>
    );
  }

  SpotMe.ProfilePage = ProfilePage;
})();
