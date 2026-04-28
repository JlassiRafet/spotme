/* ============================================================
   SpotMe — AuthCard
   Sign In, Sign Up Step 1 + 2, transitions, Stepper.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useCallback } = React;
  const { CheckIcon } = SpotMe.icons;
  const {
    TextInput, PasswordInput, PrimaryButton, GoogleButton, Divider,
    CountryDropdown, BasicDropdown, SegmentedGroup, MeasureField,
    COUNTRY_DATA, convertWeight, convertHeight
  } = SpotMe.primitives;

  /* ------------------------------------------------------------------ */
  /* Validation helpers                                                   */
  /* ------------------------------------------------------------------ */
  const NAME_RE  = /^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]{1,60}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function nameError(val) {
    if (!val.trim()) return 'This field is required.';
    if (!NAME_RE.test(val.trim())) return 'Letters only — no numbers or special characters.';
    return '';
  }
  function emailError(val) {
    if (!val.trim()) return 'Email is required.';
    if (!val.includes('@')) return 'Missing "@" — enter a valid email address.';
    if (!EMAIL_RE.test(val.trim())) return 'Enter a valid email (e.g. name@domain.com).';
    return '';
  }
  function phoneError(val, countryIso) {
    if (!val.trim()) return ''; // phone is optional
    const digits = val.replace(/\D/g, '');
    if (!digits) return 'Phone must contain digits only.';
    const country = (COUNTRY_DATA || []).find(c => c.iso === countryIso);
    if (country && digits.length !== country.digits) {
      return `${country.name} numbers must be ${country.digits} digits (you entered ${digits.length}).`;
    }
    return '';
  }

  /* Password strength checklist */
  function pwChecks(pw) {
    return {
      length:    pw.length >= 12,
      uppercase: /[A-Z]/.test(pw),
      lowercase: /[a-z]/.test(pw),
      number:    /[0-9]/.test(pw),
      symbol:    /[^A-Za-z0-9]/.test(pw),
    };
  }
  function pwAllPass(pw) {
    const c = pwChecks(pw);
    return c.length && c.uppercase && c.lowercase && c.number && c.symbol;
  }

  function PasswordChecklist({ password }) {
    const c = pwChecks(password || '');
    const items = [
      { key: 'length',    label: 'At least 12 characters' },
      { key: 'uppercase', label: 'At least one uppercase letter (A–Z)' },
      { key: 'lowercase', label: 'At least one lowercase letter (a–z)' },
      { key: 'number',    label: 'At least one number (0–9)' },
      { key: 'symbol',    label: 'At least one symbol (!@#$%…)' },
    ];
    return (
      <div className="pw-checklist">
        {items.map(item => (
          <div key={item.key} className={`pw-check${c[item.key] ? ' is-ok' : ''}`}>
            <span className="pw-check-icon">{c[item.key] ? '✓' : '○'}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Stepper                                                              */
  /* ------------------------------------------------------------------ */
  function Stepper({ step, total = 2 }) {
    const items = [];
    for (let i = 1; i <= total; i++) {
      const state = i < step ? 'is-done' : i === step ? 'is-active' : '';
      items.push(
        <div key={`n${i}`} className={`stepper-node ${state}`.trim()}>
          <span className="num">{i}</span><CheckIcon />
        </div>
      );
      if (i < total) {
        items.push(
          <div key={`l${i}`} className={`stepper-line${step > i ? ' is-filled' : ''}`}>
            <div className="stepper-line-fill" />
          </div>
        );
      }
    }
    return (
      <div className="stepper" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        {items}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Sign In form                                                         */
  /* ------------------------------------------------------------------ */
  function SignInForm({ onSwitch, onLogin }) {
    const [email, setEmail]     = useState('');
    const [password, setPassword] = useState('');
    const [touched, setTouched] = useState({});
    const [busy, setBusy]       = useState(false);
    const [error, setError]     = useState('');

    const emailErr = touched.email ? emailError(email) : '';

    const submit = async () => {
      setTouched({ email: true });
      setError('');
      const em = email.trim();
      if (!em || !password) { setError('Enter your email and password.'); return; }
      if (emailError(em)) { setError(emailError(em)); return; }
      setBusy(true);
      const r = await SpotMe.api.login(em, password);
      setBusy(false);
      if (r.ok) { onLogin(r.data.user); }
      else { setError(r.error || 'Sign in failed.'); }
    };

    return (
      <form className="auth-form" onSubmit={e => { e.preventDefault(); submit(); }}>
        <div className="auth-form-top">
          <TextInput type="email" label="Email address" placeholder="Email address"
                     autoComplete="email" value={email}
                     onChange={e => setEmail(e.target.value)}
                     onBlur={() => setTouched(t => ({ ...t, email: true }))}
                     error={emailErr} disabled={busy} />
          <PasswordInput label="Password" placeholder="Password"
                         value={password} autoComplete="current-password"
                         onChange={e => setPassword(e.target.value)} disabled={busy} />
          {error && <p className="auth-error-banner" role="alert">{error}</p>}
          <p className="switch-line">
            Don't have an account?{' '}
            <button type="button" onClick={() => onSwitch('signup-1')} disabled={busy}>Sign Up</button>
          </p>
        </div>
        <div className="auth-form-bottom">
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </PrimaryButton>
          <Divider />
          <GoogleButton label="Sign In with Google" />
        </div>
      </form>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Sign Up step 1                                                       */
  /* ------------------------------------------------------------------ */
  function SignUpStep1({ data, onChange, onNext, onSwitch, fieldErrors, onClearFieldError, disabled }) {
    const [touched, setTouched] = useState({});
    const [localError, setLocalError] = useState('');

    const touch = (k) => setTouched(t => ({ ...t, [k]: true }));
    const set   = (k) => (e) => {
      onChange({ ...data, [k]: e.target.value });
      if (fieldErrors?.[k] && onClearFieldError) onClearFieldError(k);
    };
    const setCountry = (iso) => onChange({ ...data, countryCode: iso });

    const fnErr    = touched.firstName ? (fieldErrors?.firstName || nameError(data.firstName))  : (fieldErrors?.firstName || '');
    const lnErr    = touched.lastName  ? (fieldErrors?.lastName  || nameError(data.lastName))   : (fieldErrors?.lastName  || '');
    const emErr    = touched.email     ? (fieldErrors?.email     || emailError(data.email))     : (fieldErrors?.email     || '');
    const phErr    = touched.phone     ? phoneError(data.phone, data.countryCode)               : '';
    const pwStrong = pwAllPass(data.password);

    const canAdvance =
      !nameError(data.firstName) && !nameError(data.lastName) &&
      !emailError(data.email)    && !phoneError(data.phone, data.countryCode) &&
      pwStrong;

    const handleAdvance = () => {
      setTouched({ firstName: true, lastName: true, email: true, phone: true });
      if (!canAdvance) {
        if (!pwStrong) setLocalError('Password must meet all requirements below.');
        return;
      }
      setLocalError('');
      onNext();
    };

    useEffect(() => { if (canAdvance) setLocalError(''); }, [canAdvance]);

    return (
      <form className="auth-form" onSubmit={e => { e.preventDefault(); handleAdvance(); }}>
        <div className="auth-form-top">
          <div className="two-col">
            <TextInput label="First name" placeholder="First name" autoComplete="given-name"
                       value={data.firstName}
                       onChange={set('firstName')}
                       onBlur={() => touch('firstName')}
                       error={fnErr} disabled={disabled} />
            <TextInput label="Last name" placeholder="Last name" autoComplete="family-name"
                       value={data.lastName}
                       onChange={set('lastName')}
                       onBlur={() => touch('lastName')}
                       error={lnErr} disabled={disabled} />
          </div>
          <TextInput type="email" label="Email address" placeholder="Email address"
                     autoComplete="email" value={data.email}
                     onChange={set('email')}
                     onBlur={() => touch('email')}
                     error={emErr} disabled={disabled} />
          <div className="country-phone-grid">
            <CountryDropdown value={data.countryCode} onChange={setCountry} disabled={disabled} />
            <TextInput type="tel" label="Phone number" placeholder="Phone number"
                       autoComplete="tel" value={data.phone}
                       onChange={set('phone')}
                       onBlur={() => touch('phone')}
                       error={phErr} disabled={disabled} />
          </div>

          {/* Password — single field, strength checklist replaces confirm */}
          <PasswordInput label="Password" placeholder="Password (min 12 characters)"
                         value={data.password} onChange={set('password')}
                         autoComplete="new-password"
                         error={fieldErrors?.password} disabled={disabled} />
          {data.password.length > 0 && <PasswordChecklist password={data.password} />}

          {localError && <p className="auth-error-banner" role="alert">{localError}</p>}
          <p className="switch-line">
            Already have an account?{' '}
            <button type="button" onClick={() => onSwitch('login')} disabled={disabled}>Sign In</button>
          </p>
        </div>
        <div className="auth-form-bottom">
          <PrimaryButton onClick={handleAdvance} disabled={disabled}>Continue</PrimaryButton>
          <Divider />
          <GoogleButton label="Sign Up with Google" />
        </div>
      </form>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Sign Up step 2                                                       */
  /* ------------------------------------------------------------------ */
  const LEVEL_OPTIONS = [
    { value: 'beginner',     label: 'Beginner',     sub: '< 1 year' },
    { value: 'intermediate', label: 'Intermediate', sub: '1–3 years' },
    { value: 'pro',          label: 'Pro',          sub: '3+ years' }
  ];

  /* Weight limits by unit */
  const WEIGHT_LIMITS = { kg: { min: 20, max: 300 }, lb: { min: 44, max: 660 } };
  const HEIGHT_LIMITS = { cm: { min: 50, max: 280 }, ft: { min: 1.6, max: 9.2 } };

  function weightError(val, unit) {
    if (!val && val !== 0) return '';
    const n = Number(val);
    if (isNaN(n)) return 'Enter a number.';
    const { min, max } = WEIGHT_LIMITS[unit] || WEIGHT_LIMITS.kg;
    if (n < min || n > max) return `Weight must be between ${min}–${max} ${unit}.`;
    return '';
  }
  function heightError(val, unit) {
    if (!val && val !== 0) return '';
    const n = Number(val);
    if (isNaN(n)) return 'Enter a number.';
    const { min, max } = HEIGHT_LIMITS[unit] || HEIGHT_LIMITS.cm;
    if (n < min || n > max) return `Height must be between ${min}–${max} ${unit}.`;
    return '';
  }

  function SignUpStep2({ data, onChange, onBack, onFinish, fieldErrors, disabled, submitError }) {
    const set = (k, v) => onChange({ ...data, [k]: v });

    const wErr = weightError(data.weight, data.weightUnit);
    const hErr = heightError(data.height, data.heightUnit);

    const isValid =
      data.level &&
      String(data.weight).trim() !== '' && !wErr &&
      String(data.height).trim() !== '' && !hErr &&
      data.playsSport &&
      (data.playsSport === 'No' || data.sportName.trim() !== '') &&
      data.trainingGoal.trim() !== '';

    return (
      <form className="auth-form" onSubmit={e => { e.preventDefault(); if (isValid && !disabled) onFinish(); }}>
        <div className="auth-form-top">
          <div className="field-block">
            <span className="field-label">Experience level</span>
            <SegmentedGroup options={LEVEL_OPTIONS} value={data.level}
                            onChange={(v) => set('level', v)} ariaLabel="Experience level" />
            {fieldErrors?.level && <p className="field-error">{fieldErrors.level}</p>}
          </div>
          <div className="two-col">
            <div className="field-block">
              <span className="field-label">Weight</span>
              <MeasureField label="Weight" placeholder="e.g. 70"
                            value={data.weight}
                            onChange={(e) => set('weight', e.target.value)}
                            units={['kg', 'lb']} unit={data.weightUnit}
                            min={WEIGHT_LIMITS[data.weightUnit]?.min}
                            max={WEIGHT_LIMITS[data.weightUnit]?.max}
                            onUnitChange={(u) => onChange({ ...data, weightUnit: u, weight: convertWeight(data.weight, data.weightUnit, u) })} />
              {(wErr || fieldErrors?.weight) && <p className="field-error">{wErr || fieldErrors.weight}</p>}
            </div>
            <div className="field-block">
              <span className="field-label">Height</span>
              <MeasureField label="Height" placeholder="e.g. 175"
                            value={data.height}
                            onChange={(e) => set('height', e.target.value)}
                            units={['cm', 'ft']} unit={data.heightUnit}
                            min={HEIGHT_LIMITS[data.heightUnit]?.min}
                            max={HEIGHT_LIMITS[data.heightUnit]?.max}
                            onUnitChange={(u) => onChange({ ...data, heightUnit: u, height: convertHeight(data.height, data.heightUnit, u) })} />
              {(hErr || fieldErrors?.height) && <p className="field-error">{hErr || fieldErrors.height}</p>}
            </div>
          </div>
          <div className="field-block">
            <span className="field-label">Do you play any sports?</span>
            <BasicDropdown options={['Yes', 'No']} value={data.playsSport}
                           onChange={(v) => { if (v === 'No') onChange({ ...data, playsSport: v, sportName: '' }); else onChange({ ...data, playsSport: v }); }}
                           placeholder="Select an option" label="Do you play any sports" />
            <div className={`sport-reveal${data.playsSport === 'Yes' ? ' is-open' : ''}`} aria-hidden={data.playsSport !== 'Yes'}>
              <div className="sport-reveal-inner">
                <div style={{ height: 10 }} />
                <TextInput label="Which sport" placeholder="Which sport?"
                           value={data.sportName}
                           onChange={(e) => set('sportName', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="field-block">
            <span className="field-label">Primary training goal</span>
            <TextInput label="Primary training goal"
                       placeholder="e.g. Build muscle, lose weight, run a marathon…"
                       value={data.trainingGoal}
                       onChange={(e) => set('trainingGoal', e.target.value)} />
          </div>
          {submitError && <p className="auth-error-banner" role="alert">{submitError}</p>}
          <p className="switch-line" style={{ marginTop: 2 }}>
            <button type="button" className="btn-text" onClick={onBack} disabled={disabled}>
              ← Back to details
            </button>
          </p>
        </div>
        <div className="auth-form-bottom">
          <PrimaryButton onClick={() => isValid && !disabled && onFinish()} disabled={disabled || !isValid}>
            {disabled ? 'Creating account…' : 'Finish Setup'}
          </PrimaryButton>
        </div>
      </form>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Card shell with transitions                                          */
  /* ------------------------------------------------------------------ */
  const VIEW_CONTENT = {
    'login':    { title: 'Sign In',   desc: 'Your AI coach is ready. Are you?' },
    'signup-1': { title: 'Sign Up',   desc: "Create your path. We'll guide it." },
    'signup-2': { title: 'A Few Details', desc: 'Tell us about you so we can tailor your plan.' }
  };
  const CARD_HEIGHT = { 'login': 500, 'signup-1': 700, 'signup-2': 740 };
  const EXIT_MS = 200;
  const ENTER_MS = 340;

  const SIGNUP_DATA_INITIAL = {
    firstName: '', lastName: '', email: '',
    countryCode: 'TN', phone: '',
    password: '',
    level: '',
    weight: '', weightUnit: 'kg',
    height: '', heightUnit: 'cm',
    playsSport: '', sportName: '',
    trainingGoal: ''
  };

  function AuthCard({ initialView = 'login', onAuthComplete }) {
    const [view, setView]     = useState(initialView);
    const [target, setTarget] = useState(initialView);
    const [phase, setPhase]   = useState('idle');
    const [signupData, setSignupData] = useState(SIGNUP_DATA_INITIAL);
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState(null);
    const [submitError, setSubmitError] = useState('');

    // Show OAuth error if redirected back with ?auth_error
    const [oauthError, setOauthError] = useState(() => window._spotmeOAuthError || '');
    useEffect(() => { window._spotmeOAuthError = ''; }, []);

    const handleSwitch = useCallback((nextView) => {
      if (phase === 'exiting' || nextView === view) return;
      if (view === 'signup-2' && nextView !== 'signup-2') setSubmitError('');
      // Keep the URL in sync with the auth sub-view
      const targetPath = nextView === 'login' ? '/login' : '/register';
      if (window.location.pathname !== targetPath) history.pushState({}, '', targetPath);
      setTarget(nextView);
      setPhase('exiting');
    }, [phase, view]);

    useEffect(() => {
      if (phase !== 'exiting') return;
      const t = setTimeout(() => { setView(target); setPhase('entering'); }, EXIT_MS);
      return () => clearTimeout(t);
    }, [phase, target]);
    useEffect(() => {
      if (phase !== 'entering') return;
      const t = setTimeout(() => setPhase('idle'), ENTER_MS);
      return () => clearTimeout(t);
    }, [phase]);

    useEffect(() => {
      document.title =
        view === 'login'    ? 'SpotMe - Sign In' :
        view === 'signup-1' ? 'SpotMe - Sign Up (1/2)' :
                              'SpotMe - Sign Up (2/2)';
    }, [view]);

    const handleFinish = async () => {
      if (submitting) return;
      setSubmitting(true);
      setFieldErrors(null);
      setSubmitError('');

      const payload = {
        email:        signupData.email.trim(),
        password:     signupData.password,
        firstName:    signupData.firstName.trim(),
        lastName:     signupData.lastName.trim(),
        countryCode:  signupData.countryCode || null,
        phone:        signupData.phone.trim() || null,
        level:        signupData.level,
        weight:       signupData.weight ? Number(signupData.weight) : null,
        weightUnit:   signupData.weightUnit,
        height:       signupData.height ? Number(signupData.height) : null,
        heightUnit:   signupData.heightUnit,
        playsSport:   signupData.playsSport,
        sportName:    signupData.sportName || null,
        trainingGoal: signupData.trainingGoal.trim() || null
      };

      const r = await SpotMe.api.signup(payload);
      setSubmitting(false);

      if (r.ok) { onAuthComplete && onAuthComplete(r.data.user); return; }

      let fe = r.fieldErrors || null;
      let msg = '';
      if (!fe && r.error) {
        const e = r.error.toLowerCase();
        if (e.includes('already exists') || e.includes('email')) fe = { email: r.error };
        else if (e.includes('password')) fe = { password: r.error };
        else msg = r.error;
      }

      const STEP1_KEYS = ['firstName', 'lastName', 'email', 'password'];
      const STEP2_KEYS = ['level', 'weight', 'height', 'weightUnit', 'heightUnit'];
      if (fe) {
        const keys = Object.keys(fe);
        setFieldErrors(fe);
        if (keys.some(k => STEP1_KEYS.includes(k))) { handleSwitch('signup-1'); setSubmitError(''); }
        else if (keys.some(k => STEP2_KEYS.includes(k))) setSubmitError('Please fix the highlighted fields.');
        else setSubmitError(msg || 'Sign up failed. Please try again.');
      } else {
        setSubmitError(msg || r.error || 'Sign up failed.');
      }
    };

    const { title, desc } = VIEW_CONTENT[view];
    const heightKey = phase === 'entering' ? target : view;
    const cardStyle = { '--card-h': `${CARD_HEIGHT[heightKey]}px` };
    const cardClass = `auth-card liquid${phase !== 'idle' ? ' is-transitioning' : ''}`;
    const viewClass = phase === 'exiting' ? 'auth-view is-exiting' : phase === 'entering' ? 'auth-view is-entering' : 'auth-view';
    const stepNumber = view === 'signup-1' ? 1 : view === 'signup-2' ? 2 : null;

    return (
      <section className="w-full" style={{ maxWidth: '484px' }} aria-label="Authentication card">
        <div className={cardClass} style={cardStyle}>
          <div className="auth-card-inner">
            <div className={viewClass} key={view}>
              {stepNumber !== null && <Stepper step={stepNumber} total={2} />}
              <div className="auth-header">
                <h1 className="auth-title">{title}</h1>
                <p className="auth-desc">{desc}</p>
              </div>
              {oauthError && (
                <p className="auth-error-banner" role="alert">
                  {oauthError === 'cancelled' ? 'Google sign-in was cancelled.' :
                   oauthError === 'no_email'  ? 'Could not get your email from Google.' :
                   'Google sign-in failed. Try again.'}
                </p>
              )}
              {view === 'login' && (
                <SignInForm onSwitch={handleSwitch}
                            onLogin={(user) => onAuthComplete && onAuthComplete(user)} />
              )}
              {view === 'signup-1' && (
                <SignUpStep1 data={signupData} onChange={setSignupData}
                             onNext={() => handleSwitch('signup-2')}
                             onSwitch={handleSwitch}
                             fieldErrors={fieldErrors}
                             onClearFieldError={(key) => {
                               setFieldErrors(prev => {
                                 if (!prev || !prev[key]) return prev;
                                 const next = { ...prev }; delete next[key];
                                 return Object.keys(next).length ? next : null;
                               });
                             }}
                             disabled={submitting} />
              )}
              {view === 'signup-2' && (
                <SignUpStep2 data={signupData} onChange={setSignupData}
                             onBack={() => handleSwitch('signup-1')}
                             onFinish={handleFinish}
                             fieldErrors={fieldErrors}
                             disabled={submitting}
                             submitError={submitError} />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  SpotMe.AuthCard = AuthCard;
})();
