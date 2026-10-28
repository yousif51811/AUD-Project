import { useMemo, useSyncExternalStore } from 'react';
type Display = {
    largeText?: boolean;
    highContrast?: boolean;
    reduceMotion?: boolean;
};
const memory = new Map<string, string>();
const subscribe = (listener: () => void) => { window.addEventListener('storage', listener); window.addEventListener('familymind:display', listener); return () => { window.removeEventListener('storage', listener); window.removeEventListener('familymind:display', listener); }; };
export function useDisplay(actorId: string) { const key = 'familymind:display:v1:' + actorId; const raw = useSyncExternalStore(subscribe, () => { try {
    return localStorage.getItem(key) ?? memory.get(key) ?? '{}';
}
catch {
    return memory.get(key) ?? '{}';
} }, () => '{}'); const value = useMemo<Display>(() => { try {
    return JSON.parse(raw);
}
catch {
    return {};
} }, [raw]); const update = (patch: Display) => { const next = JSON.stringify({ ...value, ...patch }); memory.set(key, next); try {
    localStorage.setItem(key, next);
}
catch { /* in-memory preference */ } window.dispatchEvent(new Event('familymind:display')); }; return [value, update] as const; }
