import { describe, expect, it, vi } from 'vitest';
import { createLanguageStore, LANGUAGE_KEY, validLanguage } from '@/lib/language';
import { translate } from '@/i18n/translate';
import { exactAnswer, systemPrompt } from '@/lib/model/assistant';
import type { AppState } from '@/state/store';
import { demoProfile } from '@/data/demo';

describe('language preference', () => {
  it('accepts only the supported languages and defaults to English', () => {
    expect(validLanguage('ar')).toBe('ar');
    for (const value of ['en', 'ar-AE', 'fr', null, '{}', undefined]) expect(validLanguage(value)).toBe('en');
  });
  it('remembers a browser preference independently of theme and old family data', () => {
    const values = new Map([['familymind:appearance:v1', 'dark'], ['familymind:v1:profile', 'original']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const store = createLanguageStore(() => storage); store.setLanguage('ar');
    expect(createLanguageStore(() => storage).getSnapshot()).toBe('ar');
    expect(values).toEqual(new Map([['familymind:appearance:v1', 'dark'], ['familymind:v1:profile', 'original'], [LANGUAGE_KEY, 'ar']]));
  });
  it('continues in memory when browser storage is blocked', () => {
    const store = createLanguageStore(() => { throw new Error('Blocked'); });
    store.setLanguage('ar'); expect(store.getSnapshot()).toBe('ar');
    store.setLanguage('en'); expect(store.getSnapshot()).toBe('en');
  });
  it('syncs another tab without redundant notifications', () => {
    const store = createLanguageStore(() => undefined), changed = vi.fn(), stop = store.subscribe(changed);
    store.sync('ar'); store.sync('ar'); expect(changed).toHaveBeenCalledTimes(1);
    store.sync(null); expect(store.getSnapshot()).toBe('en'); expect(changed).toHaveBeenCalledTimes(2);
    stop(); store.setLanguage('ar'); expect(changed).toHaveBeenCalledTimes(2);
  });
});
describe('localized interface and assistant', () => {
  it('preserves spacing and inserted record titles without re-translating them', () => {
    expect(translate(' Home ', 'ar')).toBe(' الرئيسية ');
    expect(translate('Mark complete: {title}', 'ar', { title: 'Family dinner <script>' })).toBe('وضع علامة مكتمل: Family dinner <script>');
    expect(translate('An unfamiliar error', 'ar')).toBe('An unfamiliar error');
    expect(translate('Calendar', 'en')).toBe('Calendar');
  });
  it('answers Arabic assignment questions locally while preserving recorded content', () => {
    const profile = demoProfile();
    const state = { profile, plan: { actions: [{ title: 'Synthetic task', participantIds: [profile.members[0].id], day: 1 }] } } as AppState;
    expect(exactAnswer('من المسؤول عن مهام اليوم؟', state, [], 1, 'ar')).toBe(`Synthetic task: ${profile.members[0].name}.`);
    expect(exactAnswer('من المسؤول عن مهام اليوم؟', state, [], 2, 'ar')).toBe('لم تُسجّل مسؤوليات بعد.');
  });
  it('does not infer availability from an empty calendar in either language', () => {
    const state = { profile: demoProfile(), plan: null } as AppState;
    for (const question of ['من متفرّغ الآن؟', 'من مستعد للحديث؟']) expect(exactAnswer(question, state, [], 1, 'ar')).toContain('فراغ التقويم لا يعني');
    expect(exactAnswer("Who's free right now?", state, [], 1, 'en')).toContain('An empty calendar does not mean');
    expect(systemPrompt([], 'ar')).toContain('Respond in Arabic; keep record identifiers unchanged.');
  });
  it('retains medical boundaries for Arabic questions', () => {
    const state = { profile: demoProfile() } as AppState;
    expect(exactAnswer('أريد تشخيص حالتي', state, [], 1, 'ar')).toContain('لا يشخّص');
    expect(exactAnswer('هناك شخص في خطر', state, [], 1, 'ar')).toContain('الطوارئ');
  });
});

describe('device language and explicit overrides', () => {
  it('uses the first supported regional device language and falls back to English', () => {
    expect(createLanguageStore(() => undefined, () => ['fr-FR','ar-AE','en-GB']).getSnapshot()).toBe('ar');
    expect(createLanguageStore(() => undefined, () => ['en-US','ar']).getSnapshot()).toBe('en');
    expect(createLanguageStore(() => undefined, () => ['fr-FR']).getSnapshot()).toBe('en');
  });
  it('preserves an old explicit choice and can restore device mode, including cross-tab clearing', () => {
    let stored:string|null='en'; const store=createLanguageStore(()=>({getItem:()=>stored,setItem:(_key,value)=>{stored=value;}}),()=>['ar-SA']);
    expect(store.getSnapshot()).toBe('en');store.setLanguage('system');expect(store.getSnapshot()).toBe('ar');expect(stored).toBe('system');
    store.sync('en');expect(store.getSnapshot()).toBe('en');store.sync(null);expect(store.getSnapshot()).toBe('ar');
  });
  it('follows language changes only in device mode, including blocked storage', () => {
    let locales=['ar-AE'];const store=createLanguageStore(()=>{throw new Error('blocked');},()=>locales),listener=vi.fn();store.subscribe(listener);
    expect(store.getSnapshot()).toBe('ar');locales=['en-GB'];store.deviceChanged();expect(store.getSnapshot()).toBe('en');expect(listener).toHaveBeenCalledTimes(1);
    store.setLanguage('ar');listener.mockClear();store.deviceChanged();expect(listener).not.toHaveBeenCalled();expect(store.getSnapshot()).toBe('ar');
  });
});
