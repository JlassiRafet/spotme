/* ============================================================
   SpotMe — Shared primitives
   Low-level form controls and buttons reused by every page.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { useState, useEffect, useRef } = React;
  const { EyeIcon, GoogleIcon, ChevronIcon } = SpotMe.icons;

  /* ------------------------------------------------------------------ */
  /* Country data — iso, name, dial code, expected digit count           */
  /* ------------------------------------------------------------------ */
  const COUNTRY_DATA = [
    // Africa
    { iso:'DZ', name:'Algeria',              dial:'+213', digits:9  },
    { iso:'AO', name:'Angola',               dial:'+244', digits:9  },
    { iso:'BJ', name:'Benin',                dial:'+229', digits:8  },
    { iso:'BW', name:'Botswana',             dial:'+267', digits:8  },
    { iso:'BF', name:'Burkina Faso',         dial:'+226', digits:8  },
    { iso:'BI', name:'Burundi',              dial:'+257', digits:8  },
    { iso:'CM', name:'Cameroon',             dial:'+237', digits:9  },
    { iso:'CV', name:'Cape Verde',           dial:'+238', digits:7  },
    { iso:'CF', name:'Central African Rep.', dial:'+236', digits:8  },
    { iso:'TD', name:'Chad',                 dial:'+235', digits:8  },
    { iso:'KM', name:'Comoros',              dial:'+269', digits:7  },
    { iso:'CD', name:'Congo (DRC)',          dial:'+243', digits:9  },
    { iso:'CG', name:'Congo (Republic)',     dial:'+242', digits:9  },
    { iso:'CI', name:"Côte d'Ivoire",        dial:'+225', digits:10 },
    { iso:'DJ', name:'Djibouti',             dial:'+253', digits:8  },
    { iso:'EG', name:'Egypt',               dial:'+20',  digits:10 },
    { iso:'GQ', name:'Equatorial Guinea',    dial:'+240', digits:9  },
    { iso:'ER', name:'Eritrea',              dial:'+291', digits:7  },
    { iso:'ET', name:'Ethiopia',             dial:'+251', digits:9  },
    { iso:'GA', name:'Gabon',               dial:'+241', digits:8  },
    { iso:'GM', name:'Gambia',              dial:'+220', digits:7  },
    { iso:'GH', name:'Ghana',              dial:'+233', digits:9  },
    { iso:'GN', name:'Guinea',              dial:'+224', digits:9  },
    { iso:'GW', name:'Guinea-Bissau',        dial:'+245', digits:7  },
    { iso:'KE', name:'Kenya',               dial:'+254', digits:10 },
    { iso:'LS', name:'Lesotho',              dial:'+266', digits:8  },
    { iso:'LR', name:'Liberia',              dial:'+231', digits:8  },
    { iso:'LY', name:'Libya',               dial:'+218', digits:9  },
    { iso:'MG', name:'Madagascar',           dial:'+261', digits:9  },
    { iso:'MW', name:'Malawi',              dial:'+265', digits:9  },
    { iso:'ML', name:'Mali',                dial:'+223', digits:8  },
    { iso:'MR', name:'Mauritania',           dial:'+222', digits:8  },
    { iso:'MU', name:'Mauritius',            dial:'+230', digits:8  },
    { iso:'MA', name:'Morocco',              dial:'+212', digits:9  },
    { iso:'MZ', name:'Mozambique',           dial:'+258', digits:9  },
    { iso:'NA', name:'Namibia',              dial:'+264', digits:9  },
    { iso:'NE', name:'Niger',               dial:'+227', digits:8  },
    { iso:'NG', name:'Nigeria',              dial:'+234', digits:10 },
    { iso:'RW', name:'Rwanda',              dial:'+250', digits:9  },
    { iso:'ST', name:'São Tomé & Príncipe',  dial:'+239', digits:7  },
    { iso:'SN', name:'Senegal',              dial:'+221', digits:9  },
    { iso:'SL', name:'Sierra Leone',         dial:'+232', digits:8  },
    { iso:'SO', name:'Somalia',              dial:'+252', digits:8  },
    { iso:'ZA', name:'South Africa',         dial:'+27',  digits:9  },
    { iso:'SS', name:'South Sudan',          dial:'+211', digits:9  },
    { iso:'SD', name:'Sudan',               dial:'+249', digits:9  },
    { iso:'SZ', name:'Eswatini',             dial:'+268', digits:8  },
    { iso:'TZ', name:'Tanzania',             dial:'+255', digits:9  },
    { iso:'TG', name:'Togo',                dial:'+228', digits:8  },
    { iso:'TN', name:'Tunisia',              dial:'+216', digits:8  },
    { iso:'UG', name:'Uganda',              dial:'+256', digits:9  },
    { iso:'ZM', name:'Zambia',              dial:'+260', digits:9  },
    { iso:'ZW', name:'Zimbabwe',             dial:'+263', digits:9  },
    // Americas
    { iso:'AR', name:'Argentina',            dial:'+54',  digits:10 },
    { iso:'BS', name:'Bahamas',              dial:'+1242',digits:7  },
    { iso:'BB', name:'Barbados',             dial:'+1246',digits:7  },
    { iso:'BZ', name:'Belize',              dial:'+501', digits:7  },
    { iso:'BO', name:'Bolivia',              dial:'+591', digits:8  },
    { iso:'BR', name:'Brazil',              dial:'+55',  digits:11 },
    { iso:'CA', name:'Canada',              dial:'+1',   digits:10 },
    { iso:'CL', name:'Chile',               dial:'+56',  digits:9  },
    { iso:'CO', name:'Colombia',             dial:'+57',  digits:10 },
    { iso:'CR', name:'Costa Rica',           dial:'+506', digits:8  },
    { iso:'CU', name:'Cuba',                dial:'+53',  digits:8  },
    { iso:'DO', name:'Dominican Republic',   dial:'+1849',digits:7  },
    { iso:'EC', name:'Ecuador',              dial:'+593', digits:9  },
    { iso:'SV', name:'El Salvador',          dial:'+503', digits:8  },
    { iso:'GT', name:'Guatemala',            dial:'+502', digits:8  },
    { iso:'GY', name:'Guyana',              dial:'+592', digits:7  },
    { iso:'HT', name:'Haiti',               dial:'+509', digits:8  },
    { iso:'HN', name:'Honduras',             dial:'+504', digits:8  },
    { iso:'JM', name:'Jamaica',              dial:'+1876',digits:7  },
    { iso:'MX', name:'Mexico',              dial:'+52',  digits:10 },
    { iso:'NI', name:'Nicaragua',            dial:'+505', digits:8  },
    { iso:'PA', name:'Panama',              dial:'+507', digits:8  },
    { iso:'PY', name:'Paraguay',             dial:'+595', digits:9  },
    { iso:'PE', name:'Peru',                dial:'+51',  digits:9  },
    { iso:'TT', name:'Trinidad & Tobago',    dial:'+1868',digits:7  },
    { iso:'US', name:'United States',        dial:'+1',   digits:10 },
    { iso:'UY', name:'Uruguay',              dial:'+598', digits:8  },
    { iso:'VE', name:'Venezuela',            dial:'+58',  digits:10 },
    // Asia
    { iso:'AF', name:'Afghanistan',          dial:'+93',  digits:9  },
    { iso:'AM', name:'Armenia',              dial:'+374', digits:8  },
    { iso:'AZ', name:'Azerbaijan',           dial:'+994', digits:9  },
    { iso:'BH', name:'Bahrain',              dial:'+973', digits:8  },
    { iso:'BD', name:'Bangladesh',           dial:'+880', digits:10 },
    { iso:'BT', name:'Bhutan',              dial:'+975', digits:8  },
    { iso:'BN', name:'Brunei',              dial:'+673', digits:7  },
    { iso:'KH', name:'Cambodia',             dial:'+855', digits:9  },
    { iso:'CN', name:'China',               dial:'+86',  digits:11 },
    { iso:'CY', name:'Cyprus',              dial:'+357', digits:8  },
    { iso:'GE', name:'Georgia',              dial:'+995', digits:9  },
    { iso:'IN', name:'India',               dial:'+91',  digits:10 },
    { iso:'ID', name:'Indonesia',            dial:'+62',  digits:10 },
    { iso:'IR', name:'Iran',                dial:'+98',  digits:10 },
    { iso:'IQ', name:'Iraq',                dial:'+964', digits:10 },
    { iso:'IL', name:'Israel',              dial:'+972', digits:9  },
    { iso:'JP', name:'Japan',               dial:'+81',  digits:10 },
    { iso:'JO', name:'Jordan',              dial:'+962', digits:9  },
    { iso:'KZ', name:'Kazakhstan',           dial:'+7',   digits:10 },
    { iso:'KW', name:'Kuwait',              dial:'+965', digits:8  },
    { iso:'KG', name:'Kyrgyzstan',           dial:'+996', digits:9  },
    { iso:'LA', name:'Laos',                dial:'+856', digits:9  },
    { iso:'LB', name:'Lebanon',              dial:'+961', digits:8  },
    { iso:'MY', name:'Malaysia',             dial:'+60',  digits:9  },
    { iso:'MV', name:'Maldives',             dial:'+960', digits:7  },
    { iso:'MN', name:'Mongolia',             dial:'+976', digits:8  },
    { iso:'MM', name:'Myanmar',              dial:'+95',  digits:9  },
    { iso:'NP', name:'Nepal',               dial:'+977', digits:10 },
    { iso:'OM', name:'Oman',                dial:'+968', digits:8  },
    { iso:'PK', name:'Pakistan',             dial:'+92',  digits:10 },
    { iso:'PS', name:'Palestine',            dial:'+970', digits:9  },
    { iso:'PH', name:'Philippines',          dial:'+63',  digits:10 },
    { iso:'QA', name:'Qatar',               dial:'+974', digits:8  },
    { iso:'RU', name:'Russia',              dial:'+7',   digits:10 },
    { iso:'SA', name:'Saudi Arabia',         dial:'+966', digits:9  },
    { iso:'SG', name:'Singapore',            dial:'+65',  digits:8  },
    { iso:'KR', name:'South Korea',          dial:'+82',  digits:10 },
    { iso:'LK', name:'Sri Lanka',            dial:'+94',  digits:9  },
    { iso:'SY', name:'Syria',               dial:'+963', digits:9  },
    { iso:'TW', name:'Taiwan',              dial:'+886', digits:9  },
    { iso:'TJ', name:'Tajikistan',           dial:'+992', digits:9  },
    { iso:'TH', name:'Thailand',             dial:'+66',  digits:9  },
    { iso:'TR', name:'Turkey',              dial:'+90',  digits:10 },
    { iso:'TM', name:'Turkmenistan',         dial:'+993', digits:8  },
    { iso:'AE', name:'UAE',                 dial:'+971', digits:9  },
    { iso:'UZ', name:'Uzbekistan',           dial:'+998', digits:9  },
    { iso:'VN', name:'Vietnam',              dial:'+84',  digits:9  },
    { iso:'YE', name:'Yemen',               dial:'+967', digits:9  },
    // Europe
    { iso:'AL', name:'Albania',              dial:'+355', digits:9  },
    { iso:'AD', name:'Andorra',              dial:'+376', digits:6  },
    { iso:'AT', name:'Austria',              dial:'+43',  digits:10 },
    { iso:'BY', name:'Belarus',              dial:'+375', digits:9  },
    { iso:'BE', name:'Belgium',              dial:'+32',  digits:9  },
    { iso:'BA', name:'Bosnia & Herzegovina', dial:'+387', digits:8  },
    { iso:'BG', name:'Bulgaria',             dial:'+359', digits:9  },
    { iso:'HR', name:'Croatia',              dial:'+385', digits:9  },
    { iso:'CZ', name:'Czech Republic',       dial:'+420', digits:9  },
    { iso:'DK', name:'Denmark',              dial:'+45',  digits:8  },
    { iso:'EE', name:'Estonia',              dial:'+372', digits:8  },
    { iso:'FI', name:'Finland',              dial:'+358', digits:9  },
    { iso:'FR', name:'France',              dial:'+33',  digits:9  },
    { iso:'DE', name:'Germany',              dial:'+49',  digits:10 },
    { iso:'GR', name:'Greece',              dial:'+30',  digits:10 },
    { iso:'HU', name:'Hungary',              dial:'+36',  digits:9  },
    { iso:'IS', name:'Iceland',              dial:'+354', digits:7  },
    { iso:'IE', name:'Ireland',              dial:'+353', digits:9  },
    { iso:'IT', name:'Italy',               dial:'+39',  digits:10 },
    { iso:'XK', name:'Kosovo',              dial:'+383', digits:8  },
    { iso:'LV', name:'Latvia',              dial:'+371', digits:8  },
    { iso:'LI', name:'Liechtenstein',        dial:'+423', digits:7  },
    { iso:'LT', name:'Lithuania',            dial:'+370', digits:8  },
    { iso:'LU', name:'Luxembourg',           dial:'+352', digits:9  },
    { iso:'MT', name:'Malta',               dial:'+356', digits:8  },
    { iso:'MD', name:'Moldova',              dial:'+373', digits:8  },
    { iso:'MC', name:'Monaco',              dial:'+377', digits:8  },
    { iso:'ME', name:'Montenegro',           dial:'+382', digits:8  },
    { iso:'NL', name:'Netherlands',          dial:'+31',  digits:9  },
    { iso:'MK', name:'North Macedonia',      dial:'+389', digits:8  },
    { iso:'NO', name:'Norway',              dial:'+47',  digits:8  },
    { iso:'PL', name:'Poland',              dial:'+48',  digits:9  },
    { iso:'PT', name:'Portugal',             dial:'+351', digits:9  },
    { iso:'RO', name:'Romania',              dial:'+40',  digits:9  },
    { iso:'RS', name:'Serbia',              dial:'+381', digits:9  },
    { iso:'SK', name:'Slovakia',             dial:'+421', digits:9  },
    { iso:'SI', name:'Slovenia',             dial:'+386', digits:8  },
    { iso:'ES', name:'Spain',               dial:'+34',  digits:9  },
    { iso:'SE', name:'Sweden',              dial:'+46',  digits:9  },
    { iso:'CH', name:'Switzerland',          dial:'+41',  digits:9  },
    { iso:'UA', name:'Ukraine',              dial:'+380', digits:9  },
    { iso:'GB', name:'United Kingdom',       dial:'+44',  digits:10 },
    // Oceania
    { iso:'AU', name:'Australia',            dial:'+61',  digits:9  },
    { iso:'FJ', name:'Fiji',                dial:'+679', digits:7  },
    { iso:'NZ', name:'New Zealand',          dial:'+64',  digits:9  },
    { iso:'PG', name:'Papua New Guinea',     dial:'+675', digits:8  },
    { iso:'WS', name:'Samoa',               dial:'+685', digits:7  },
    { iso:'SB', name:'Solomon Islands',      dial:'+677', digits:7  },
    { iso:'TO', name:'Tonga',               dial:'+676', digits:7  },
    { iso:'VU', name:'Vanuatu',              dial:'+678', digits:7  },
  ];

  /* Flag emoji from ISO code */
  function flag(iso) {
    try {
      return String.fromCodePoint(...[...iso.toUpperCase()].map(c => c.charCodeAt(0) + 127397));
    } catch { return '🌐'; }
  }

  /* ------------------------------------------------------------------ */
  /* TextInput                                                            */
  /* ------------------------------------------------------------------ */
  function TextInput({ type = 'text', placeholder, label, autoComplete, value, onChange, readOnly, style, error, hint, disabled }) {
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
        {hint  && !error && <span className="field-hint">{hint}</span>}
        {error && <span className="field-error" role="alert">{error}</span>}
      </label>
    );
  }

  /* ------------------------------------------------------------------ */
  /* PasswordInput                                                         */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* Buttons                                                              */
  /* ------------------------------------------------------------------ */
  function PrimaryButton({ children, onClick, disabled }) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="btn-base btn-primary liquid">
        <span className="btn-glow" />
        <span className="btn-label">{children}</span>
      </button>
    );
  }

  function GoogleButton({ label, onClick }) {
    const handleClick = () => {
      if (onClick) { onClick(); return; }
      window.location.href = '/api/auth/google';
    };
    return (
      <button type="button" aria-label={label} className="btn-base btn-google liquid" onClick={handleClick}>
        <span className="btn-glow" />
        <GoogleIcon />
        <span>{label}</span>
      </button>
    );
  }

  function Divider() {
    return (
      <div className="auth-divider">
        <span className="line" /><span>Or</span><span className="line" />
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* CountryDropdown — searchable, 180+ countries                        */
  /* ------------------------------------------------------------------ */
  function CountryDropdown({ value, onChange, disabled }) {
    const [open, setOpen]     = useState(false);
    const [search, setSearch] = useState('');
    const rootRef   = useRef(null);
    const searchRef = useRef(null);
    const listRef   = useRef(null);

    const selected = COUNTRY_DATA.find(c => c.iso === value) || COUNTRY_DATA.find(c => c.iso === 'TN');

    const filtered = COUNTRY_DATA.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search)
    );

    useEffect(() => {
      if (!open) return;
      if (searchRef.current) searchRef.current.focus();
      function outside(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
      function esc(e) { if (e.key === 'Escape') setOpen(false); }
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', esc);
      return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
    }, [open]);

    return (
      <label className="block">
        <span className="sr-only">Country code</span>
        <div className="relative-wrap" ref={rootRef}>
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => { setOpen(o => !o); setSearch(''); }}
            className={`country-button${open ? ' is-open' : ''}`}
          >
            <span>{flag(selected.iso)} {selected.dial}</span>
            <span className="chevron"><ChevronIcon /></span>
          </button>

          {open && (
            <div className="country-menu" role="listbox" aria-label="Country codes">
              <div className="country-search-wrap">
                <input
                  ref={searchRef}
                  type="text"
                  className="country-search-input"
                  placeholder="Search country…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="country-options-list" ref={listRef} role="listbox">
                {filtered.length === 0 && (
                  <div className="country-empty">No results</div>
                )}
                {filtered.map(c => (
                  <button
                    type="button" key={c.iso} role="option"
                    aria-selected={c.iso === value}
                    onClick={() => { onChange(c.iso); setOpen(false); setSearch(''); }}
                    className={`country-option${c.iso === value ? ' is-selected' : ''}`}
                  >
                    <span className="country-flag">{flag(c.iso)}</span>
                    <span className="country-name">{c.name}</span>
                    <span className="country-dial">{c.dial}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </label>
    );
  }

  /* ------------------------------------------------------------------ */
  /* BasicDropdown                                                        */
  /* ------------------------------------------------------------------ */
  function BasicDropdown({ options, value, onChange, placeholder, label }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    useEffect(() => {
      function outside(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
      function esc(e) { if (e.key === 'Escape') setOpen(false); }
      document.addEventListener('click', outside);
      document.addEventListener('keydown', esc);
      return () => { document.removeEventListener('click', outside); document.removeEventListener('keydown', esc); };
    }, []);
    return (
      <div className="relative-wrap" ref={rootRef}>
        {label && <span className="sr-only">{label}</span>}
        <button
          type="button" aria-haspopup="listbox" aria-expanded={open}
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
              <button type="button" key={opt} role="option"
                      aria-selected={opt === value}
                      onClick={() => { onChange(opt); setOpen(false); }}
                      className={`country-option${opt === value ? ' is-selected' : ''}`}>
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* SegmentedGroup                                                       */
  /* ------------------------------------------------------------------ */
  function SegmentedGroup({ options, value, onChange, ariaLabel }) {
    return (
      <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
        {options.map(opt => (
          <button type="button" key={opt.value} role="radio"
                  aria-checked={value === opt.value}
                  onClick={() => onChange(opt.value)}
                  className={`segmented-option${value === opt.value ? ' is-selected' : ''}`}>
            <span>{opt.label}</span>
            {opt.sub && <span className="sub">{opt.sub}</span>}
          </button>
        ))}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* MeasureField                                                         */
  /* ------------------------------------------------------------------ */
  function MeasureField({ placeholder, label, value, onChange, unit, onUnitChange, units, readOnly, min, max }) {
    return (
      <label className="block">
        <span className="sr-only">{label}</span>
        <div className="measure-field">
          <input
            type="number" inputMode="decimal"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            className="auth-input"
            min={min ?? 0}
            max={max}
          />
          <div className="unit-toggle" role="radiogroup" aria-label={`${label} unit`}>
            {units.map(u => (
              <button key={u} type="button" role="radio"
                      aria-checked={unit === u}
                      onClick={() => { if (!readOnly && u !== unit) onUnitChange(u); }}
                      className={`unit-opt${unit === u ? ' is-selected' : ''}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </label>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Unit conversions                                                     */
  /* ------------------------------------------------------------------ */
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
    COUNTRY_DATA, convertWeight, convertHeight
  };
})();
