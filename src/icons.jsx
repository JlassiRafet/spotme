/* ============================================================
   SpotMe — Icon library
   All icons used across the app. Each is a small SVG component
   attached to window.SpotMe.icons so any other .jsx file can
   consume them via e.g. const { EyeIcon } = window.SpotMe.icons.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  SpotMe.icons = {};

  function EyeIcon({ visible }) {
    if (visible) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  function GoogleIcon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.85z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-3c-1.07.72-2.44 1.15-4.09 1.15-3.15 0-5.82-2.13-6.78-5H1.23v3.09A11.99 11.99 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.22 14.24A7.2 7.2 0 0 1 4.84 12c0-.78.14-1.53.38-2.24V6.67H1.23A12 12 0 0 0 0 12c0 1.93.46 3.76 1.23 5.33l3.99-3.09z" />
        <path fill="#EA4335" d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.14 15.24 0 12 0A11.99 11.99 0 0 0 1.23 6.67l3.99 3.09c.96-2.87 3.63-5 6.78-5z" />
      </svg>
    );
  }

  function ChevronIcon() {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.18l3.71-3.95a.75.75 0 1 1 1.1 1.02l-4.25 4.52a.75.75 0 0 1-1.1 0L5.21 8.25a.75.75 0 0 1 .02-1.04z" />
      </svg>
    );
  }

  function CheckIcon() {
    return (
      <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  function SpotMeLogo({ size = 28, withText = false }) {
    // Rounded-square "SM" monogram with brand gradient + a subtle
    // dumbbell-bar accent across the middle to hint at fitness.
    return (
      <span className="spotme-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <linearGradient id="smGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"  stopColor="#ffaa55" />
              <stop offset="55%" stopColor="#ff6b00" />
              <stop offset="100%" stopColor="#e65000" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="44" height="44" rx="12"
                fill="url(#smGrad)"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1" />
          <text x="24" y="31" textAnchor="middle"
                fontFamily='"Anthropic Sans", Inter, system-ui, sans-serif'
                fontSize="20" fontWeight="800" letterSpacing="-1"
                fill="#ffffff"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
            SM
          </text>
        </svg>
        {withText && <span className="spotme-wordmark">SpotMe</span>}
      </span>
    );
  }

  function HomeIcon()   { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>); }
  function PlusIcon()   { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>); }
  function HistoryIcon(){ return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/><polyline points="12 7 12 12 15 14"/></svg>); }
  function TrackerIcon(){ return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>); }
  function BellIcon({ active }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        {!active && <line x1="3" y1="3" x2="21" y2="21" />}
      </svg>
    );
  }
  function MicIcon()    { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>); }
  function SendIcon()   { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>); }
  function CameraIcon() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>); }
  function ImageIcon()  { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><polyline points="21 15 16 10 5 21"/></svg>); }
  function CrownIcon()  { return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 18h20v2H2zM3 6l4 4 5-6 5 6 4-4v10H3z"/></svg>); }
  function ArrowLeftIcon()  { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>); }
  function ArrowRightIcon() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>); }
  function UserIcon()   { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>); }
  function TrashIcon()  { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>); }
  function SparkleIcon(){ return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/></svg>); }
  function LogoutIcon() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>); }

  Object.assign(SpotMe.icons, {
    EyeIcon, GoogleIcon, ChevronIcon, CheckIcon, SpotMeLogo,
    HomeIcon, PlusIcon, HistoryIcon, TrackerIcon, BellIcon,
    MicIcon, SendIcon, CameraIcon, ImageIcon, CrownIcon,
    ArrowLeftIcon, ArrowRightIcon, UserIcon, TrashIcon, SparkleIcon, LogoutIcon
  });
})();
