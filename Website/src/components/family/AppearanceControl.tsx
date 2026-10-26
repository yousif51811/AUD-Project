import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { APPEARANCE_KEY, createAppearanceStore, resolveAppearance } from '@/lib/appearance';

const appearance = createAppearanceStore(() => typeof window === 'undefined' ? undefined : window.localStorage);
const systemQuery = '(prefers-color-scheme: dark)';

export function AppearanceControl() {
  const preference = useSyncExternalStore(appearance.subscribe, appearance.getSnapshot);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(systemQuery).matches);
  const resolved = resolveAppearance(preference, systemDark);
  useEffect(() => {
    const media = window.matchMedia(systemQuery);
    const onChange = () => setSystemDark(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) appearance.syncStoredPreference(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => { media.removeEventListener('change', onChange); window.removeEventListener('storage', onStorage); };
  }, []);
  const previousTheme = useRef(resolved);
  useEffect(() => {
    const root = document.documentElement;
    const changed = previousTheme.current !== resolved;
    previousTheme.current = resolved;
    if (changed) root.classList.add('theme-changing');
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#1d231f' : '#f8f7f2');
    const timer = changed ? window.setTimeout(() => root.classList.remove('theme-changing'), 360) : undefined;
    return () => { window.clearTimeout(timer); root.classList.remove('theme-changing'); };
  }, [resolved]);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const next = resolved === 'dark' ? 'light' : 'dark';
  const modeLabel = preference === 'system' ? `Following device: ${resolved}` : `${resolved === 'dark' ? 'Dark' : 'Light'} theme`;
  return <div className={`appearance-control${tooltipDismissed ? ' tooltip-dismissed' : ''}`} onMouseEnter={() => setTooltipDismissed(false)}>
    <button className="appearance-toggle" type="button" aria-label={`Switch to ${next} theme`}
      aria-describedby="appearance-help" data-appearance={resolved}
      onFocus={() => setTooltipDismissed(false)} onKeyDown={(event) => { if (event.key === 'Escape') setTooltipDismissed(true); }}
      onClick={() => appearance.setPreference(next)}>
      <Sun className="appearance-sun" size={20} aria-hidden />
      <Moon className="appearance-moon" size={20} aria-hidden />
      {preference === 'system' && <span className="appearance-auto-dot" aria-hidden />}
    </button>
    <span className="appearance-tooltip" id="appearance-help" role="tooltip">
      {modeLabel}. Switch to {next}.<br />Use device theme in the family menu.
    </span>
  </div>;
}

/** A separate reset keeps the header a single, predictable light/dark button. */
export function SystemAppearanceControl() {
  const preference = useSyncExternalStore(appearance.subscribe, appearance.getSnapshot);
  return <div className="appearance-system">
    <div><span className="paper-label">APPEARANCE</span><p>{preference === 'system' ? 'Following your device automatically.' : `You chose the ${preference} theme.`}</p></div>
    <button type="button" className="btn btn-secondary btn-sm" aria-pressed={preference === 'system'} onClick={() => appearance.setPreference('system')}>
      <Monitor size={16} aria-hidden />{preference === 'system' ? 'Device theme on' : 'Use device theme'}
    </button>
  </div>;
}
