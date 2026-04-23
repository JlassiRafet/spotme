/* ============================================================
   SpotMe — Shared primitives
   Low-level form controls and buttons reused by every page.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
  const { EyeIcon, GoogleIcon, ChevronIcon } = SpotMe.icons;

  function TextInput({ type = 'text', placeholder, label, autoComplete, value, onChange, readOnly, style, error, disabled }) {
    return (
      <label className="block" style={style}>
        <span className="sr-only">{label}</span>
        <input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          disabled={disabled}
          className={`auth-input${error ? ' has-error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
        />
        {error && <span className="field-error" role="alert">{error}</span>}
      </label>
    );
  }

  function PasswordInput({ placeholder, label, value, onChange, autoComplete, error, disabled }) {
    const [visible, setVisible] = useState(false);
    return (
      <label className="block">
        <span className="sr-only">{label}</span>
        <div className="relative-wrap">
          <input
            type={visible ? 'text' : 'password'}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            disabled={disabled}
            className={`auth-input has-toggle${error ? ' has-error' : ''}`}
            aria-invalid={error ? 'true' : undefined}
          />
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="input-toggle"
            disabled={disabled}
          >
            <EyeIcon visible={visible} />
          </button>
        </div>
        {error && <span className="field-error" role="alert">{error}</span>}
      </label>
    );
  }

  function PrimaryButton({ children, onClick, disabled }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="btn-base btn-primary liquid"
      >
        <span className="btn-glow" />
        <span className="btn-label">{children}</span>
      </button>
    );
  }

  function GoogleButton({ label }) {
    return (
      <button type="button" aria-label={label} className="btn-base btn-google liquid">
        <span className="btn-glow" />
        <GoogleIcon />
        <span>{label}</span>
      </button>
    );
  }

  function Divider() {
    return (
      <div className="auth-divider">
        <span className="line" />
        <span>Or</span>
        <span className="line" />
      </div>
    );
  }

  const COUNTRY_CODES = ['TN +216', 'US +1', 'UK +44', 'FR +33', 'UAE +971'];

  function CountryDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    useEffect(() => {
      function handleClickOutside(e) {
        if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
      }
      function handleEsc(e) { if (e.key === 'Escape') setOpen(false); }
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEsc);
      };
    }, []);
    return (
      <label className="block">
        <span className="sr-only">Country code</span>
        <div className="relative-wrap" ref={rootRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
            className={`country-button${open ? ' is-open' : ''}`}
          >
            <span>{value}</span>
            <span className="chevron"><ChevronIcon /></span>
          </button>
          {open && (
            <div className="country-menu" role="listbox" aria-label="Country codes">
              {COUNTRY_CODES.map(code => (
                <button
                  type="button" key={code} role="option"
                  aria-selected={code === value}
                  onClick={() => { onChange(code); setOpen(false); }}
                  className={`country-option${code === value ? ' is-selected' : ''}`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>
      </label>
    );
  }

  function BasicDropdown({ options, value, onChange, placeholder, label }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    useEffect(() => {
      function handleClickOutside(e) {
        if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
      }
      function handleEsc(e) { if (e.key === 'Escape') setOpen(false); }
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEsc);
      };
    }, []);
    return (
      <div className="relative-wrap" ref={rootRef}>
        {label && <span className="sr-only">{label}</span>}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className={`country-button${open ? ' is-open' : ''}`}
          style={value ? undefined : { color: '#a1b3d4', fontWeight: 400 }}
        >
          <span>{value || placeholder}</span>
          <span className="chevron"><ChevronIcon /></span>
        </button>
        {open && (
          <div className="country-menu" role="listbox" aria-label={label || 'Options'}>
            {options.map(opt => (
              <button
                type="button" key={opt} role="option"
                aria-selected={opt === value}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`country-option${opt === value ? ' is-selected' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function SegmentedGroup({ options, value, onChange, ariaLabel }) {
    return (
      <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
        {options.map(opt => (
          <button
            type="button" key={opt.value} role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`segmented-option${value === opt.value ? ' is-selected' : ''}`}
          >
            <span>{opt.label}</span>
            {opt.sub && <span className="sub">{opt.sub}</span>}
          </button>
        ))}
      </div>
    );
  }

  function MeasureField({ placeholder, label, value, onChange, unit, onUnitChange, units, readOnly }) {
    return (
      <label className="block">
        <span className="sr-only">{label}</span>
        <div className="measure-field">
          <input
            type="number"
            inputMode="decimal"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            className="auth-input"
            min="0"
          />
          <div className="unit-toggle" role="radiogroup" aria-label={`${label} unit`}>
            {units.map(u => (
              <button
                key={u} type="button" role="radio"
                aria-checked={unit === u}
                onClick={() => { if (!readOnly && u !== unit) onUnitChange(u); }}
                className={`unit-opt${unit === u ? ' is-selected' : ''}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </label>
    );
  }

  // Unit conversions used by both signup step 2 and the profile page.
  function convertWeight(value, fromUnit, toUnit) {
    if (!value || isNaN(value)) return value;
    const n = parseFloat(value);
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'kg' && toUnit === 'lb') return (n * 2.20462).toFixed(1);
    if (fromUnit === 'lb' && toUnit === 'kg') return (n / 2.20462).toFixed(1);
    return value;
  }
  function convertHeight(value, fromUnit, toUnit) {
    if (!value || isNaN(value)) return value;
    const n = parseFloat(value);
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'cm' && toUnit === 'ft') return (n / 30.48).toFixed(2);
    if (fromUnit === 'ft' && toUnit === 'cm') return (n * 30.48).toFixed(1);
    return value;
  }

  SpotMe.primitives = {
    TextInput, PasswordInput, PrimaryButton, GoogleButton, Divider,
    CountryDropdown, BasicDropdown, SegmentedGroup, MeasureField,
    COUNTRY_CODES, convertWeight, convertHeight
  };
})();
