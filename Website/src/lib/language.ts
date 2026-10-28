/** Browser preference only: never attached to household records or provider requests. */
export type Language = 'en' | 'ar';
export type LanguagePreference = Language | 'system';
export const LANGUAGE_KEY = 'familymind:language:v1';
export function validLanguage(value: unknown): Language { return value === 'ar' ? 'ar' : 'en'; }
export function languagePreference(value: unknown): LanguagePreference { return value === 'en' || value === 'ar' ? value : 'system'; }
export function deviceLanguage(languages: readonly string[]): Language {
  for (const locale of languages) { const base = locale.toLowerCase().split('-')[0]; if (base === 'en' || base === 'ar') return base; }
  return 'en';
}
export function createLanguageStore(storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined, device: () => readonly string[] = () => typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]) {
  let preference: LanguagePreference = 'system', initialized = false;
  const listeners = new Set<() => void>();
  const getPreference = () => { if (!initialized) { try { preference = languagePreference(storage()?.getItem(LANGUAGE_KEY)); } catch { /* device mode */ } initialized = true; } return preference; };
  const getSnapshot = () => getPreference() === 'system' ? deviceLanguage(device()) : preference as Language;
  const update = (next: LanguagePreference) => { const previous = getPreference(); preference = next; if (previous !== next) listeners.forEach(fn => fn()); };
  return {
    getSnapshot, getPreference,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setLanguage(next: LanguagePreference) { update(next); try { storage()?.setItem(LANGUAGE_KEY, next); } catch { /* Keep this visit usable when storage is blocked. */ } },
    sync(value: unknown) { update(languagePreference(value)); },
    deviceChanged() { if (getPreference() === 'system') listeners.forEach(fn => fn()); },
  };
}

export const languageStore = createLanguageStore(() => typeof window === 'undefined' ? undefined : window.localStorage);
