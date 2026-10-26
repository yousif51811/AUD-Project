import { describe, expect, it, vi } from 'vitest';
import { APPEARANCE_KEY, createAppearanceStore, parseAppearance, resolveAppearance } from '@/lib/appearance';

describe('appearance preference', () => {
  it('follows device changes only while System is selected', () => {
    expect(resolveAppearance('system', false)).toBe('light');
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });
  it('uses System for missing, corrupted and retired design values', () => {
    for (const value of [null, undefined, 'expressive', 'original', '{}', 'LIGHT']) expect(parseAppearance(value)).toBe('system');
  });
  it('persists separately from family data and restores the explicit choice', () => {
    const values = new Map([['familymind:v1:profile', 'untouched']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const store = createAppearanceStore(() => storage);
    store.setPreference('dark');
    expect(createAppearanceStore(() => storage).getSnapshot()).toBe('dark');
    expect(values).toEqual(new Map([['familymind:v1:profile', 'untouched'], [APPEARANCE_KEY, 'dark']]));
  });
  it('keeps changes in memory when storage access or writes throw', () => {
    for (const getStorage of [() => { throw new Error('Blocked'); }, () => ({ getItem: () => null, setItem: () => { throw new Error('Full'); } })]) {
      const store = createAppearanceStore(getStorage);
      store.setPreference('dark');
      expect(store.getSnapshot()).toBe('dark');
      store.setPreference('light');
      expect(store.getSnapshot()).toBe('light');
    }
  });
  it('syncs other-tab changes and falls back to System when the key is cleared', () => {
    const store = createAppearanceStore(() => undefined);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.syncStoredPreference('dark');
    expect(store.getSnapshot()).toBe('dark');
    store.syncStoredPreference('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    store.syncStoredPreference(null);
    expect(store.getSnapshot()).toBe('system');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.setPreference('light');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
