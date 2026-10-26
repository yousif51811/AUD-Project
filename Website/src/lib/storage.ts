/** Storage abstraction: namespaced, versioned, corruption-tolerant, SSR-safe. */
export const KEYS = {
  profile: 'familymind:v1:profile',
  assessment: 'familymind:v1:assessment',
  plan: 'familymind:v1:plan',
  schedule: 'familymind:v1:schedule',
  memories: 'familymind:v1:memories',
  care: 'familymind:v1:care',
  student: 'familymind:v1:student',
  draft: 'familymind:v1:assessment-draft',
  seeded: 'familymind:v1:seeded',
  introSeen: 'familymind:intro:seen:v1',
} as const;

export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

const memory = new Map<string, string>();
export const memoryStore: KVStore = {
  getItem: (k) => (memory.has(k) ? (memory.get(k) as string) : null),
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function defaultStore(kind: 'local' | 'session' = 'local'): KVStore {
  try {
    if (typeof window === 'undefined') return memoryStore;
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__fm_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return memoryStore;
  }
}

interface Envelope<T> {
  v: 1;
  data: T;
}

export function serialize<T>(data: T): string {
  const env: Envelope<T> = { v: 1, data };
  return JSON.stringify(env);
}

export function deserialize<T>(raw: string | null, validate: (x: unknown) => x is T): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Envelope<unknown>;
    if (!parsed || parsed.v !== 1) return null;
    return validate(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function load<T>(key: string, validate: (x: unknown) => x is T, store: KVStore = defaultStore()): T | null {
  try {
    return deserialize(store.getItem(key), validate);
  } catch {
    return null;
  }
}

export function save<T>(key: string, data: T, store: KVStore = defaultStore()): boolean {
  try {
    store.setItem(key, serialize(data));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string, store: KVStore = defaultStore()): void {
  try {
    store.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function clearAllFamilyData(): void {
  for (const k of Object.values(KEYS)) {
    if (k === KEYS.introSeen || k === KEYS.seeded) continue;
    remove(k);
  }
}

export function sessionFlag(key: string): boolean {
  try {
    return defaultStore('session').getItem(key) === '1';
  } catch {
    return false;
  }
}
export function setSessionFlag(key: string): void {
  try {
    defaultStore('session').setItem(key, '1');
  } catch {
    /* ignore */
  }
}
export function clearSessionFlag(key: string): void {
  try {
    defaultStore('session').removeItem(key);
  } catch {
    /* ignore */
  }
}

export const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
export const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export function storageAvailable(): boolean {
  return defaultStore() !== memoryStore;
}
