/** Appearance stays independent of household data, including when storage is blocked. */
export type Appearance = 'light' | 'dark' | 'system';
export const APPEARANCE_KEY = 'familymind:appearance:v1';
export function parseAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveAppearance(preference: Appearance, systemDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
interface AppearanceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function createAppearanceStore(getStorage: () => AppearanceStorage | undefined) {
  let preference: Appearance = 'system';
  try { preference = parseAppearance(getStorage()?.getItem(APPEARANCE_KEY)); } catch { /* Use the device setting. */ }
  const listeners = new Set<() => void>();
  const update = (value: Appearance) => {
    if (preference === value) return;
    preference = value;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => preference,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setPreference(value: Appearance) {
      update(value);
      try { getStorage()?.setItem(APPEARANCE_KEY, value); } catch { /* Keep the in-memory choice. */ }
    },
    syncStoredPreference(value: string | null) { update(parseAppearance(value)); },
  };
}
