import { useEffect, useId } from 'react';
import { Languages } from 'lucide-react';
import { languageStore, useLanguage } from '@/i18n';
import { LANGUAGE_KEY, type LanguagePreference } from '@/lib/language';

/** Mounted once with the shell; changing language preserves mounted forms and planner state. */
export function LanguageEffects() {
  const { language } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === LANGUAGE_KEY || event.key === null) languageStore.sync(event.newValue); };
    window.addEventListener('storage', sync);
    window.addEventListener('languagechange', languageStore.deviceChanged);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('languagechange', languageStore.deviceChanged); };
  }, []);
  return null;
}
export function LanguageSettings() {
  const { preference, setLanguage, t } = useLanguage(), id = useId();
  return <label className="field">{t('Website language')}<select className="select" aria-label={t('Website language')} aria-describedby={id} value={preference} onChange={event => setLanguage(event.target.value as LanguagePreference)}>
    <option value="system">{t('Device language')}</option><option value="en">English</option><option value="ar">العربية</option>
  </select><span id={id} className="hint">{t('Device follows your browser language. Your choice applies only to this browser, without changing family content.')}</span></label>;
}
export function LanguageControl({ expanded = false }: { expanded?: boolean }) {
  const { language, setLanguage } = useLanguage(), id = useId();
  const next = language === 'en' ? 'ar' : 'en';
  return <div className={`language-control${expanded ? ' language-expanded' : ''}`}>
    <button type="button" className={expanded ? 'btn btn-secondary btn-sm' : 'appearance-toggle language-toggle'}
      aria-label={next === 'ar' ? 'Switch to Arabic · العربية' : 'Switch to English · English'} aria-describedby={id}
      onClick={() => setLanguage(next)}>
      {expanded && <Languages size={17} aria-hidden/>}<span lang={next} dir={next === 'ar' ? 'rtl' : 'ltr'}>{expanded ? next === 'ar' ? 'العربية' : 'English' : next === 'ar' ? 'ع' : 'EN'}</span>
    </button>
    <span id={id} className={expanded ? 'sr-only' : 'language-tooltip'} role="tooltip" lang={next} dir={next === 'ar' ? 'rtl' : 'ltr'}>{next === 'ar' ? 'العربية' : 'English'}</span>
  </div>;
}
