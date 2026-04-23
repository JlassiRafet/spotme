/* ============================================================
   SpotMe — AuthCard
   Login, Signup Step 1 + 2, transitions, Stepper.

   Wired to the backend:
     - LoginForm           → POST /api/auth/login
     - AuthCard.handleFinish → POST /api/auth/signup

   Per-field errors coming from the backend are surfaced inline
   (e.g. "email" → shown under the email field on signup-1, "weight"
   under the weight field on signup-2).

   On success, calls onAuthComplete(user) with the user object the
   server returned — App.jsx uses that to route to the main shell.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useCallback } = React;
  const { CheckIcon } = SpotMe.icons;
  const {
    TextInput, PasswordInput, PrimaryButton, GoogleButton, Divider,
    CountryDropdown, BasicDropdown, SegmentedGroup, MeasureField,
    convertWeight, convertHeight
  } = SpotMe.primitives;

  /* ---------- Stepper ---------- */

  function Stepper({ step, total = 2 }) {
    const items = [];
    for (let i = 1; i <= total; i++) {
      const state = i < step ? 'is-done' : i === step ? 'is-active' : '';
      items.push(
        <div key={`n${i}`} className={`stepper-node ${state}`.trim()}>
          <span className="num">{i}</span>
          <CheckIcon />
        </div>
      );
      if (i < total) {
        const isFilled = step > i;
        items.push(
          <div key={`l${i}`} className={`stepper-line${isFilled ? ' is-filled' : ''}`}>
            <div className="stepper-line-fill" />
          </div>
        );
      }
    }
    return (
      <div className="stepper" role="progressbar"
           aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        {items}
      </div>
    );
  }

  /* ---------- Login form (real API) ---------- */

  function LoginForm({ onSwitch, onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
      setError('');
      const em = email.trim();
      if (!em || !password) {
        setError('Enter your email and password.');
        return;
      }
      setBusy(true);
      const r = await SpotMe.api.login(em, password);
      setBusy(false);
      if (r.ok) {
        onLogin(r.data.user);
      } else {
        setError(r.error || 'Login failed.');
      }
    };

    return (
      <form className="auth-form" onSubmit={e => { e.preventDefault(); submit(); }}>
        <div className="auth-form-top">
          <TextInput type="email" label="Email address" placeholder="Email address"
                     autoComplete="email" value={email}
                     onChange={e => setEmail(e.target.value)} disabled={busy} />
          <PasswordInput label="Password" placeholder="Password"
                         value={password} autoComplete="current-password"
                         onChange={e => setPassword(e.target.value)} disabled={busy} />
          {error && <p className="auth-error-banner" role="alert">{error}</p>}
          <p className="switch-line">
            Don't have an account?{' '}
            <button type="button" onClick={() => onSwitch('signup-1')} disabled={busy}>
              Create account
            </button>
          </p>
        </div>
        <div className="auth-form-bottom">
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Logging in…' : 'Log In'}
          </PrimaryButton>
          <Divider />
          <GoogleButton label="Log In via Google" />
        </div>
      </form>
    );
  }

  /* ---------- Signup step 1 ---------- */

  function SignupStep1({ data, onChange, onNext, onSwitch, fieldErrors, onClearFieldError, disabled }) {
    const set = (k) => (e) => {
      onChange({ ...data, [k]: e.target.value });
      // Clear server-side error for this field the moment the user edits it —
      // keeps the red highlight from lingering after they've fixed it.
      if (fieldErrors?.[k] && onClearFieldError) onClearFieldError(k);
    };
    const setCountry = (code) => onChange({ ...data, countryCode: code });

    // Client-side advance check: non-empty fields and passwords match.
    // Server will re-validate and reject anything we miss.
    const passwordsMatch = data.password === data.confirmPassword;
    const canAdvance =
      data.firstName.trim() && data.lastName.trim() && data.email.trim() &&
      data.password && data.confirmPassword && passwordsMatch;

    const [localError, setLocalError] = useState('');
    useEffect(() => {
      if (data.password && data.confirmPassword && !passwordsMatch) {
        setLocalError('Passwords don\'t match.');
      } else {
        setLocalError('');
      }
    }, [data.password, data.confirmPassword, passwordsMatch]);

    const handleAdvance = () => {
      if (!canAdvance) {
        if (!passwordsMatch) setLocalError('Passwords don\'t match.');
        return;
      }
      onNext();
    };

    return (
      <form className="auth-form" onSubmit={e => { e.preventDefault(); handleAdvance(); }}>
        <div className="auth-form-top">
          <div className="two-col">
            <TextInput label="First name" placeholder="First name" autoComplete="given-name"
                       value={data.firstName} onChange={set('firstName')}
                       error={fieldErrors?.firstName} disabled={disabled} />
            <TextInput label="Last name" placeholder="Last name" autoComplete="family-name"
                       value={data.lastName} onChange={set('lastName')}
                       error={fieldErrors?.lastName} disabled={disabled} />
          </div>
          <TextInput type="email" label="Email address" placeholder="Email address"
                     autoComplete="email" value={data.email} onChange={set('email')}
                     error={fieldErrors?.email} disabled={disabled} />
          <div className="country-phone-grid">
            <CountryDropdown value={data.countryCode} onChange={setCountry} disabled={disabled} />
            <TextInput type="tel" label="Phone number" placeholder="Phone number"
                       autoComplete="tel" value={data.phone} onChange={set('phone')}
                       disabled={disabled} />
          </div>
          <div className="two-col">
            <PasswordInput label="Password" placeholder="Password"
                           value={data.password} onChange={set('password')}
                           autoComplete="new-password"
                           error={fieldErrors?.password} disabled={disabled} />
            <PasswordInput label="Reinsert password" placeholder="Reinsert password"
                           value={data.confirmPassword} onChange={set('confirmPassword')}
                           autoComplete="new-password" disabled={disabled} />
          </div>
          {localError && <p className="auth-error-banner" role="alert">{localError}</p>}
          <p className="switch-line">
            Already have an account?{' '}
            <button type="button" onClick={() => onSwitch('login')} disabled={disabled}>Log in</button>
          </p>
        </div>
        <div className="auth-form-bottom">
          <PrimaryButton onClick={handleAdvance} disabled={disabled}>Create Account</PrimaryButton>
          <Divider />
          <GoogleButton label="Sign In via Google" />
        </div>
      </form>
    );
  }

  /* ---------- Signup step 2 ---------- */

  const LEVEL_OPTIONS = [
    { value: 'beginner',     label: 'Beginner',     sub: '< 1 year' },
    { value: 'intermediate', label: 'Intermediate', sub: '1–3 years' },
    { value: 'pro',          label: 'Pro',          sub: '3+ years' }
  ];

  function SignupStep2({ data, onChange, onBack, onFinish, fieldErrors, disabled, submitError }) {
    const set = (k, v) => onChange({ ...data, [k]: v });
    const isValid =
      data.level &&
      String(data.weight).trim() !== '' &&
      String(data.height).trim() !== '' &&
      data.playsSport &&
      (data.playsSport === 'No' || data.sportName.trim() !== '') &&
      data.trainingGoal.trim() !== '';

    return (
      <form className="auth-form" onSubmit={e => { e.preventDefault(); if (isValid && !disabled) onFinish(); }}>
        <div className="auth-form-top">
          <div className="field-block">
            <span className="field-label">Experience level</span>
            <SegmentedGroup options={LEVEL_OPTIONS} value={data.level}
                            onChange={(v) => set('level', v)}
                            ariaLabel="Experience level" />
            {fieldErrors?.level && <p className="field-error">{fieldErrors.level}</p>}
          </div>
          <div className="two-col">
            <div className="field-block">
              <span className="field-label">Weight</span>
              <MeasureField label="Weight" placeholder="e.g. 70"
                            value={data.weight}
                            onChange={(e) => set('weight', e.target.value)}
                            units={['kg', 'lb']}
                            unit={data.weightUnit}
                            onUnitChange={(u) => onChange({
                              ...data, weightUnit: u,
                              weight: convertWeight(data.weight, data.weightUnit, u)
                            })} />
              {fieldErrors?.weight && <p className="field-error">{fieldErrors.weight}</p>}
            </div>
            <div className="field-block">
              <span className="field-label">Height</span>
              <MeasureField label="Height" placeholder="e.g. 175"
                            value={data.height}
                            onChange={(e) => set('height', e.target.value)}
                            units={['cm', 'ft']}
                            unit={data.heightUnit}
                            onUnitChange={(u) => onChange({
                              ...data, heightUnit: u,
                              height: convertHeight(data.height, data.heightUnit, u)
                            })} />
              {fieldErrors?.height && <p className="field-error">{fieldErrors.height}</p>}
            </div>
          </div>
          <div className="field-block">
            <span className="field-label">Do you play any sports?</span>
            <BasicDropdown options={['Yes', 'No']} value={data.playsSport}
                           onChange={(v) => {
                             if (v === 'No') onChange({ ...data, playsSport: v, sportName: '' });
                             else onChange({ ...data, playsSport: v });
                           }}
                           placeholder="Select an option"
                           label="Do you play any sports" />
            <div className={`sport-reveal${data.playsSport === 'Yes' ? ' is-open' : ''}`}
                 aria-hidden={data.playsSport !== 'Yes'}>
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

  /* ---------- Card shell with transitions ---------- */

  const VIEW_CONTENT = {
    'login':    { title: 'Welcome Back',   desc: 'Your AI coach is ready. Are you?' },
    'signup-1': { title: 'Create Account', desc: "Create your path. We'll guide it." },
    'signup-2': { title: 'A Few Details',  desc: 'Tell us about you so we can tailor your plan.' }
  };
  const CARD_HEIGHT = { 'login': 500, 'signup-1': 660, 'signup-2': 740 };
  const EXIT_MS = 200;
  const ENTER_MS = 340;

  const SIGNUP_DATA_INITIAL = {
    firstName: '', lastName: '', email: '',
    countryCode: 'TN +216', phone: '',
    password: '', confirmPassword: '',
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

    // Signup submission state lives here (not in SignupStep2) so the
    // error doesn't get cleared when the signup-2 view re-mounts.
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState(null);
    const [submitError, setSubmitError] = useState('');

    const handleSwitch = useCallback((nextView) => {
      if (phase === 'exiting' || nextView === view) return;
      // Clear the banner when navigating between views so stale messages
      // don't linger. Field-level errors persist so the user can see which
      // field caused the rewind (handleFinish clears them on the next submit).
      if (view === 'signup-2' && nextView !== 'signup-2') {
        setSubmitError('');
      }
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
        view === 'login'    ? 'SpotMe - Log In' :
        view === 'signup-1' ? 'SpotMe - Sign Up (1/2)' :
                              'SpotMe - Sign Up (2/2)';
    }, [view]);

    const { title, desc } = VIEW_CONTENT[view];
    const heightKey = phase === 'entering' ? target : view;
    const cardStyle = { '--card-h': `${CARD_HEIGHT[heightKey]}px` };
    const cardClass = `auth-card liquid${phase !== 'idle' ? ' is-transitioning' : ''}`;
    const viewClass =
      phase === 'exiting'  ? 'auth-view is-exiting'  :
      phase === 'entering' ? 'auth-view is-entering' :
                             'auth-view';
    const stepNumber = view === 'signup-1' ? 1 : view === 'signup-2' ? 2 : null;

    /* ---- the real signup submit ---- */
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

      if (r.ok) {
        onAuthComplete && onAuthComplete(r.data.user);
        return;
      }

      // Normalize various error shapes into { fieldErrors, remainingMessage }.
      // The backend returns three shapes we care about:
      //   1. { fieldErrors: {...} }                 — per-field validation
      //   2. "An account with that email already exists." (409)
      //   3. "Something else happened" (500/502/other)
      //
      // Shape (2) is a plain string but semantically it's an email-field
      // error, so we synthesize a fieldErrors object so the field turns
      // red on step 1 instead of showing a mystery banner on step 2.
      let fieldErrors = r.fieldErrors || null;
      let remainingMessage = '';

      if (!fieldErrors && r.error) {
        const e = r.error.toLowerCase();
        if (e.includes('already exists') || e.includes('email')) {
          fieldErrors = { email: r.error };
        } else if (e.includes('password')) {
          fieldErrors = { password: r.error };
        } else {
          remainingMessage = r.error;
        }
      }

      // Step-1 field keys — if any error touches these, we rewind to step 1
      // so the user sees the highlighted field inline.
      const STEP1_KEYS = ['firstName', 'lastName', 'email', 'password'];
      const STEP2_KEYS = ['level', 'weight', 'height', 'weightUnit', 'heightUnit'];

      if (fieldErrors) {
        const keys = Object.keys(fieldErrors);
        const hasStep1 = keys.some(k => STEP1_KEYS.includes(k));
        const hasStep2 = keys.some(k => STEP2_KEYS.includes(k));

        setFieldErrors(fieldErrors);

        if (hasStep1) {
          // Rewind to step 1 and clear the step-2 banner — step 1 will show
          // the red highlight + message under the relevant field.
          handleSwitch('signup-1');
          setSubmitError('');
        } else if (hasStep2) {
          // Pure step-2 errors — keep the banner visible so user knows something
          // went wrong, but also highlight the specific step-2 fields.
          setSubmitError('Please fix the highlighted fields.');
        } else {
          // Unknown field keys — show a generic banner on step 2 rather than
          // pretending fields are highlighted when they're not.
          setSubmitError(remainingMessage || 'Sign up failed. Please try again.');
        }
      } else {
        // No field-level info at all — generic banner.
        setSubmitError(remainingMessage || r.error || 'Sign up failed.');
      }
    };

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
              {view === 'login' && (
                <LoginForm onSwitch={handleSwitch}
                           onLogin={(user) => onAuthComplete && onAuthComplete(user)} />
              )}
              {view === 'signup-1' && (
                <SignupStep1 data={signupData} onChange={setSignupData}
                             onNext={() => handleSwitch('signup-2')}
                             onSwitch={handleSwitch}
                             fieldErrors={fieldErrors}
                             onClearFieldError={(key) => {
                               setFieldErrors(prev => {
                                 if (!prev || !prev[key]) return prev;
                                 const next = { ...prev };
                                 delete next[key];
                                 return Object.keys(next).length ? next : null;
                               });
                             }}
                             disabled={submitting} />
              )}
              {view === 'signup-2' && (
                <SignupStep2 data={signupData} onChange={setSignupData}
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
