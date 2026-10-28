import { useSyncExternalStore } from 'react';
import { languageStore } from '@/lib/language';
import { translate } from './translate';
export { languageStore } from '@/lib/language';
export { translate } from './translate';

/** Translate interface copy only. Never pass names, notes or other member-authored content. */
export function t(text: string, values?: Record<string, string | number>): string { return translate(text, languageStore.getSnapshot(), values); }
export function useLanguage() {
  const language = useSyncExternalStore(languageStore.subscribe, languageStore.getSnapshot, () => 'en' as const);
  const preference = useSyncExternalStore(languageStore.subscribe, languageStore.getPreference, () => 'system' as const);
  return { language, preference, setLanguage: languageStore.setLanguage, t };
}
