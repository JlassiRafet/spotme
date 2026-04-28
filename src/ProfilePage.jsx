/* ============================================================
   SpotMe — Settings page (two-panel on desktop, stacked on mobile)
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
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

  /* ── applyTheme ─────────────────────────────────────────── */
  function applyTheme(pref) {
    const dark = pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : pref === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  /* ── LanguageModal ──────────────────────────────────────── */
  function LanguageModal({ current, onSelect, onClose }) {
    const { t } = SpotMe.useTranslation();
    const { LANGUAGES } = SpotMe.i18n;
    const overlayRef = useRef(null);

    useEffect(() => {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
      <div className="settings-modal-overlay" ref={overlayRef}
           onClick={e => { if (e.target === overlayRef.current) onClose(); }}
           role="dialog" aria-modal="true" aria-label="Choose language">
        <div className="settings-modal">
          <div className="settings-modal-header">
            <span className="settings-modal-title">{t('settings.language')}</span>
            <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="settings-modal-body">
            {LANGUAGES.map(lang => (
              <button key={lang.code} type="button"
                      className={`settings-modal-item${current === lang.code ? ' is-active' : ''}`}
                      onClick={() => { onSelect(lang.code); onClose(); }}>
                <span className="settings-modal-item-native">{lang.nativeLabel}</span>
                {lang.label !== lang.nativeLabel && (
                  <span className="settings-modal-item-en">{lang.label}</span>
                )}
                {current === lang.code && (
                  <span className="settings-modal-check" aria-label="Selected">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                         strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── AppearanceModal ────────────────────────────────────── */
  function AppearanceModal({ current, onSelect, onClose }) {
    const { t } = SpotMe.useTranslation();
    const overlayRef = useRef(null);

    useEffect(() => {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const OPTIONS = [
      {
        id: 'dark', label: t('appearance.dark'),
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ),
      },
      {
        id: 'light', label: t('appearance.light'),
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ),
      },
      {
        id: 'system', label: t('appearance.system'),
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        ),
      },
    ];

    return (
      <div className="settings-modal-overlay" ref={overlayRef}
           onClick={e => { if (e.target === overlayRef.current) onClose(); }}
           role="dialog" aria-modal="true" aria-label="Choose appearance">
        <div className="settings-modal settings-modal--sm">
          <div className="settings-modal-header">
            <span className="settings-modal-title">{t('settings.appearance')}</span>
            <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="settings-modal-body">
            {OPTIONS.map(opt => (
              <button key={opt.id} type="button"
                      className={`settings-modal-item${current === opt.id ? ' is-active' : ''}`}
                      onClick={() => { onSelect(opt.id); onClose(); }}>
                <span className="settings-modal-item-icon">{opt.icon}</span>
                <span className="settings-modal-item-native">{opt.label}</span>
                {current === opt.id && (
                  <span className="settings-modal-check" aria-label="Selected">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                         strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── DeleteAccountDialog ────────────────────────────────── */
  function DeleteAccountDialog({ onConfirm, onCancel, busy }) {
    const { t } = SpotMe.useTranslation();
    const [input, setInput] = useState('');
    const confirmPhrase = t('delete.confirm');
    const match = input.trim().toLowerCase() === confirmPhrase.toLowerCase();
    return (
      <div className="delete-dialog-overlay" role="dialog" aria-modal="true">
        <div className="delete-dialog">
          <h3 className="delete-dialog-title">{t('delete.title')}</h3>
          <p className="delete-dialog-body">{t('delete.body')}</p>
          <p className="delete-dialog-prompt">
            {t('delete.prompt').split(confirmPhrase).map((part, i, arr) =>
              i < arr.length - 1
                ? [part, <strong key={i}>{confirmPhrase}</strong>]
                : part
            )}
          </p>
          <input type="text" className="auth-input" value={input}
                 onChange={e => setInput(e.target.value)}
                 placeholder={confirmPhrase} autoFocus disabled={busy} />
          <div className="delete-dialog-actions">
            <button type="button" className="profile-row-btn" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>
            <button type="button" className="profile-row-btn danger" onClick={onConfirm} disabled={!match || busy}>
              {busy ? t('delete.busy') : t('delete.action')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* NAV_SECTIONS is computed inside the component so labels re-translate live */

  function ProfilePage({ profile, onNavigate, onUpdateProfile, onDeleteAccount, onLogout, initialSection }) {
    const fileInputRef = useRef(null);
    const { t } = SpotMe.useTranslation();

    const [activeSection, setActiveSection] = useState(initialSection || 'account');
    const [editing, setEditing]             = useState(false);
    const [editName, setEditName]           = useState('');
    const [editUsername, setEditUsername]   = useState('');
    const [spellCheck, setSpellCheck]       = useState(false);
    const [toast, setToast]                 = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleting, setDeleting]           = useState(false);
    const [deleteError, setDeleteError]     = useState('');

    /* NAV_SECTIONS — built here so labels update on language change */
    const NAV_SECTIONS = [
      {
        id: 'account', label: t('settings.account'),
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
      },
      {
        id: 'app', label: t('settings.app'),
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="20" y2="12"/>
                <line x1="12" y1="18" x2="20" y2="18"/>
              </svg>
      },
      {
        id: 'about', label: t('settings.about'),
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
      },
    ];

    /* Language state */
    const [language, setLanguage] = useState(
      () => localStorage.getItem('spotme-language') || 'en'
    );
    const [showLangModal, setShowLangModal] = useState(false);

    /* Appearance state */
    const [appearance, setAppearance] = useState(
      () => localStorage.getItem('spotme-theme') || 'system'
    );
    const [showAppearModal, setShowAppearModal] = useState(false);

    /* Apply appearance on mount + when changed */
    useEffect(() => {
      applyTheme(appearance);
    }, [appearance]);

    /* Listen for OS theme change when set to System */
    useEffect(() => {
      if (appearance !== 'system') return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }, [appearance]);

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

    function handleSelectLanguage(code) {
      SpotMe.i18n.changeLanguage(code);
      setLanguage(code);
    }

    function handleSelectAppearance(pref) {
      localStorage.setItem('spotme-theme', pref);
      setAppearance(pref);
    }

    const planLabel = profile.subscription === 'pro' ? 'SpotMe Pro' : 'Free';

    /* Derive display labels */
    const currentLang = SpotMe.i18n.LANGUAGES.find(l => l.code === language);
    const langLabel = currentLang ? currentLang.nativeLabel : 'English';
    const appearanceLabel = t(`appearance.${appearance}`);

    return (
      <div className="settings-layout">

        {/* ── Left nav (hidden on mobile) ── */}
        <nav className="settings-nav">
          <div className="settings-nav-title">{t('settings.title')}</div>
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
                    <input type="text" className="auth-input" placeholder={t('settings.fullName')}
                           value={editName} onChange={e => setEditName(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                           autoFocus />
                    <input type="text" className="auth-input" placeholder={t('settings.username')}
                           value={editUsername} onChange={e => setEditUsername(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                  </div>
                  <div className="settings-edit-actions">
                    <button type="button" className="profile-row-btn" onClick={cancelEdit}>{t('common.cancel')}</button>
                    <button type="button" className="profile-row-btn primary" onClick={saveEdit}>{t('settings.saveProfile')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="settings-name">{displayName || 'SpotMe'}</div>
                  <div className="settings-handle">@{profile.username || 'username'}</div>
                  <button type="button" className="settings-edit-btn" onClick={startEdit}>{t('settings.editProfile')}</button>
                </>
              )}
            </div>

            <div className="settings-section-label">{t('settings.account')}</div>
            <div className="settings-card">
              <SettingsRow label={t('settings.email')} value={profile.email} chevron={false} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.subscription')} value={planLabel} chevron={false} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.upgradePro')} onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.restorePurchases')} onClick={comingSoon} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.notifications')} onClick={comingSoon} badge={t('common.soon')} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.dataControls')} onClick={comingSoon} badge={t('common.soon')} />
            </div>

            <div className="settings-bottom-actions">
              {onLogout && (
                <button type="button" className="settings-logout-btn" onClick={onLogout}>
                  <LogoutIcon /> {t('settings.logout')}
                </button>
              )}
              <button type="button" className="settings-delete-btn"
                      onClick={() => { setShowDeleteDialog(true); setDeleteError(''); }}>
                <TrashIcon /> {t('settings.deleteAccount')}
              </button>
              {deleteError && <p className="auth-error-banner" role="alert">{deleteError}</p>}
            </div>
          </div>

          {/* App panel */}
          <div className={`settings-panel${activeSection === 'app' ? ' is-active' : ''}`}>
            <div className="settings-section-label">{t('settings.app')}</div>
            <div className="settings-card">
              <SettingsRow
                label={t('settings.language')}
                value={langLabel}
                onClick={() => setShowLangModal(true)}
              />
              <div className="settings-card-divider" />
              <SettingsRow
                label={t('settings.appearance')}
                value={appearanceLabel}
                onClick={() => setShowAppearModal(true)}
              />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.spellCheck')} toggle={spellCheck} onToggle={setSpellCheck} />
            </div>
          </div>

          {/* About panel */}
          <div className={`settings-panel${activeSection === 'about' ? ' is-active' : ''}`}>
            <div className="settings-section-label">{t('settings.about')}</div>
            <div className="settings-card">
              <SettingsRow label={t('settings.reportBug')} onClick={() => window.open('mailto:support@spotme.ai?subject=Bug%20Report', '_blank')} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.helpCenter')} onClick={() => onNavigate('help-center')} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.terms')} onClick={() => onNavigate('terms')} />
              <div className="settings-card-divider" />
              <SettingsRow label={t('settings.privacy')} onClick={() => onNavigate('privacy')} />
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

        {showLangModal && (
          <LanguageModal
            current={language}
            onSelect={handleSelectLanguage}
            onClose={() => setShowLangModal(false)}
          />
        )}

        {showAppearModal && (
          <AppearanceModal
            current={appearance}
            onSelect={handleSelectAppearance}
            onClose={() => setShowAppearModal(false)}
          />
        )}
      </div>
    );
  }

  SpotMe.ProfilePage = ProfilePage;
})();
