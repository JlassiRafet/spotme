/* ============================================================
   SpotMe — TabBar
   Mobile-only floating bottom bar. 4 fixed slots that map directly
   to AppShell route names: home, activities, programs, membership.
   The active slot uses the mint pill style from the reference image.
   ============================================================ */

(function () {
  const SpotMe = (window.SpotMe = window.SpotMe || {});
  const { HomeIcon, CalendarIcon, DumbbellIcon, CrownIcon } = SpotMe.icons;

  const TABS = [
    { name: 'home',       label: 'Home',       Icon: HomeIcon },
    { name: 'activities', label: 'Activities', Icon: CalendarIcon },
    { name: 'programs',   label: 'Programs',   Icon: DumbbellIcon },
    { name: 'membership', label: 'Membership', Icon: CrownIcon }
  ];

  function TabBar({ activeName, onNavigate }) {
    return (
      <nav className="fit-tabbar" role="tablist" aria-label="Primary navigation">
        {TABS.map(({ name, label, Icon }) => {
          const isActive = activeName === name;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              className={`fit-tabbar-btn${isActive ? ' is-active' : ''}`}
              onClick={() => onNavigate(name)}
            >
              <span style={{ width: 22, height: 22, display: 'inline-flex' }}>
                <Icon />
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  SpotMe.TabBar = TabBar;
})();
