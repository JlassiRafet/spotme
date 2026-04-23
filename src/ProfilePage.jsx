/* ============================================================
   SpotMe — Profile page
   Account info + Metrics + Subscription. All fields editable
   except email (locked at signup). Changes applied immediately.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useRef } = React;
  const { CrownIcon, TrashIcon, UserIcon, CameraIcon } = SpotMe.icons;
  const {
    TextInput, SegmentedGroup, MeasureField,
    convertWeight, convertHeight, PrimaryButton
  } = SpotMe.primitives;

  const LEVEL_OPTIONS = [
    { value: 'beginner',     label: 'Beginner',     sub: '< 1 year' },
    { value: 'intermediate', label: 'Intermediate', sub: '1–3 years' },
    { value: 'pro',          label: 'Pro',          sub: '3+ years' }
  ];

  /* A single "editable row" with label, current value, and a button
     that toggles between view and edit mode. When editing, the input
     is shown; clicking Save applies the change. */
  function EditableRow({ label, value, onSave, type = 'text', placeholder }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const startEdit = () => { setDraft(value); setEditing(true); };
    const save = () => {
      const trimmed = (draft || '').trim();
      if (trimmed) onSave(trimmed);
      setEditing(false);
    };
    return (
      <div className="profile-row">
        <div className="profile-row-info">
          <span className="profile-row-label">{label}</span>
          {editing ? (
            <input type={type} value={draft} autoFocus
                   placeholder={placeholder}
                   onChange={e => setDraft(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                   className="auth-input profile-inline-input" />
          ) : (
            <span className="profile-row-value">{value || <em className="muted">(not set)</em>}</span>
          )}
        </div>
        {editing ? (
          <div className="profile-row-actions">
            <button type="button" className="btn-text" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="profile-row-btn" onClick={save}>Save</button>
          </div>
        ) : (
          <button type="button" className="profile-row-btn" onClick={startEdit}>Change {label.toLowerCase()}</button>
        )}
      </div>
    );
  }

  function ProfilePage({ profile, onUpdateProfile }) {
    const fileInputRef = useRef(null);

    const handleAvatarChoose = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      // Read into a data URL — in-memory only; clears on refresh.
      const reader = new FileReader();
      reader.onload = (ev) => onUpdateProfile({ ...profile, avatar: ev.target.result });
      reader.readAsDataURL(file);
    };
    const deleteAvatar = () => onUpdateProfile({ ...profile, avatar: null });

    const displayName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    return (
      <div className="profile-page">
        {/* --------- Account --------- */}
        <section className="profile-section">
          <h2 className="profile-section-title">Account</h2>
          <div className="profile-divider" />

          <div className="profile-row profile-avatar-row">
            <div className="profile-row-info">
              <div className="profile-avatar-wrap">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="profile-avatar-img" />
                  : <div className="profile-avatar-fallback"><UserIcon /></div>}
              </div>
              <div>
                <div className="profile-display-name">{displayName || 'Your name'}</div>
                <div className="profile-username">@{profile.username || 'username'}</div>
              </div>
            </div>
            <div className="profile-row-actions">
              <input ref={fileInputRef} type="file" accept="image/*"
                     onChange={handleAvatarChoose}
                     style={{ display: 'none' }} />
              <button type="button" className="profile-row-btn"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                <CameraIcon /> <span>Change avatar</span>
              </button>
              {profile.avatar && (
                <button type="button" className="profile-row-btn danger"
                        onClick={deleteAvatar}>
                  <TrashIcon /> <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          <EditableRow
            label="Full Name"
            value={displayName}
            onSave={(newVal) => {
              const parts = newVal.split(/\s+/);
              onUpdateProfile({
                ...profile,
                firstName: parts[0] || '',
                lastName: parts.slice(1).join(' ')
              });
            }}
            placeholder="e.g. Jane Doe"
          />
          <EditableRow
            label="Username"
            value={profile.username}
            onSave={(newVal) => onUpdateProfile({ ...profile, username: newVal.toLowerCase().replace(/\s+/g, '') })}
            placeholder="e.g. jane.doe"
          />

          {/* Email is display-only */}
          <div className="profile-row">
            <div className="profile-row-info">
              <span className="profile-row-label">Email</span>
              <span className="profile-row-value">{profile.email || <em className="muted">(not set)</em>}</span>
              <span className="profile-row-hint">Email can't be changed after signup.</span>
            </div>
          </div>
        </section>

        {/* --------- Metrics --------- */}
        <section className="profile-section">
          <h2 className="profile-section-title">Metrics</h2>
          <div className="profile-divider" />

          <div className="profile-metrics-grid">
            <div className="field-block">
              <span className="field-label">Weight</span>
              <MeasureField label="Weight" placeholder="e.g. 70"
                            value={profile.weight}
                            onChange={e => onUpdateProfile({ ...profile, weight: e.target.value })}
                            units={['kg', 'lb']}
                            unit={profile.weightUnit || 'kg'}
                            onUnitChange={(u) => onUpdateProfile({
                              ...profile, weightUnit: u,
                              weight: convertWeight(profile.weight, profile.weightUnit || 'kg', u)
                            })} />
            </div>
            <div className="field-block">
              <span className="field-label">Height</span>
              <MeasureField label="Height" placeholder="e.g. 175"
                            value={profile.height}
                            onChange={e => onUpdateProfile({ ...profile, height: e.target.value })}
                            units={['cm', 'ft']}
                            unit={profile.heightUnit || 'cm'}
                            onUnitChange={(u) => onUpdateProfile({
                              ...profile, heightUnit: u,
                              height: convertHeight(profile.height, profile.heightUnit || 'cm', u)
                            })} />
            </div>
          </div>

          <div className="field-block" style={{ marginTop: 18 }}>
            <span className="field-label">Experience level</span>
            <SegmentedGroup options={LEVEL_OPTIONS}
                            value={profile.level}
                            onChange={(v) => onUpdateProfile({ ...profile, level: v })}
                            ariaLabel="Experience level" />
          </div>
        </section>

        {/* --------- Subscription --------- */}
        <section className="profile-section">
          <h2 className="profile-section-title">Your Subscription</h2>
          <div className="profile-divider" />

          <div className="profile-subscription-row">
            <div>
              <div className="subscription-headline">
                {profile.subscription === 'pro'
                  ? <span>Thanks for subscribing to SpotMe <span className="pro-badge">Pro</span></span>
                  : <span>You're on the <strong>Free</strong> plan</span>}
              </div>
              <div className="subscription-sub">
                {profile.subscription === 'pro'
                  ? "Explore all your Pro features including progress tracking."
                  : "Upgrade to unlock progress tracking, personalized plans, and more."}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="profile-row-btn">View details ↗</button>
              {profile.subscription !== 'pro' && (
                <button type="button" className="profile-row-btn primary"
                        onClick={() => onUpdateProfile({ ...profile, subscription: 'pro' })}>
                  <CrownIcon /> <span>Upgrade plan</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  SpotMe.ProfilePage = ProfilePage;
})();
