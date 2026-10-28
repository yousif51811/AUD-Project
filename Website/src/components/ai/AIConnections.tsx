import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWorkspace } from '@/workspace/Workspace';
import { cancelAIRequests } from '@/lib/model/engine';
import { deviceStorageKey, openConnections, sealConnections } from '@/lib/model/connection-storage';
import { connectionSchema, type AIConnection, type ProviderId } from '@/lib/model/providers';

type Connections = Partial<Record<ProviderId, AIConnection>>;
interface Snapshot { tag: string; selected: ProviderId; connections: Connections; }
interface ConnectionContext {
  selected: ProviderId; connections: Connections; ready: boolean; notice: string;
  select: (provider: ProviderId) => void;
  connect: (connection: AIConnection) => Promise<boolean>;
  disconnect: (provider: ProviderId) => Promise<void>;
}
const Context = createContext<ConnectionContext | null>(null);
const empty = (): Snapshot => ({ tag: '', selected: 'groq', connections: {} });

/** This state and its optional encrypted browser copy never use the application API. */
export function AIConnectionsProvider({ children }: { children: ReactNode }) {
  const w = useWorkspace();
  const familyId = w.family?.id;
  const scope = w.mode === 'account' && w.user && w.family ? `${w.user.id}:${w.family.id}` : `demo:${w.actorId}`;
  const tag = `${scope}:${w.mode}:${w.generation}:${w.identity?.publicKey ?? ''}`;
  const currentTag = useRef(tag); currentTag.current = tag;
  const [state, setState] = useState<Snapshot>(empty), [notice, setNotice] = useState(''), [loadedTag, setLoadedTag] = useState('');
  const stateRef = useRef(state), revision = useRef(0);
  const publish = (value: Snapshot) => { stateRef.current = value; setState(value); };

  useEffect(() => {
    let live = true;
    const current: Snapshot = { tag, selected: 'groq', connections: {} };
    stateRef.current = current; setState(current); setNotice(''); setLoadedTag('');
    if (w.mode === 'account' && w.identity && familyId) {
      const identity = w.identity;
      void (async () => {
        try {
          const raw = localStorage.getItem(deviceStorageKey(scope));
          if (!raw) return;
          const saved = await openConnections(raw, scope, identity);
          if (!live || currentTag.current !== tag || stateRef.current !== current) return;
          const next = { tag, selected: saved.selected, connections: Object.fromEntries(saved.connections.map(c => [c.provider, c])) };
          stateRef.current = next; setState(next);
        } catch { if (live) setNotice('Saved AI connections could not be unlocked on this browser. Reconnect a provider; your family data is unaffected.'); }
        finally { if (live && currentTag.current === tag) setLoadedTag(tag); }
      })();
    } else setLoadedTag(tag);
    return () => { live = false; };
  }, [scope, tag, w.mode, w.identity, familyId]);

  useEffect(() => {
    const clear = () => { revision.current++; cancelAIRequests(); stateRef.current = empty(); setState(empty()); setLoadedTag(''); setNotice(''); };
    window.addEventListener('familymind:clear-ai', clear);
    return () => { clear(); window.removeEventListener('familymind:clear-ai', clear); };
  }, []);

  const persist = async (next: Snapshot) => {
    const turn = ++revision.current;
    if (w.mode !== 'account' || !w.identity || !w.family) return false;
    const remembered = Object.values(next.connections).filter((c): c is AIConnection => !!c?.remember);
    const raw = remembered.length ? await sealConnections(scope, next.selected, remembered, w.identity) : null;
    if (currentTag.current !== tag || turn !== revision.current) throw new DOMException('Connection changed.', 'AbortError');
    try {
      if (raw) localStorage.setItem(deviceStorageKey(scope), raw);
      else localStorage.removeItem(deviceStorageKey(scope));
      return true;
    } catch {
      setNotice('Connected settings are available for this visit, but browser storage could not be updated. Saved settings may need clearing through your browser’s site-data controls.');
      const temporary = { ...next, connections: Object.fromEntries(Object.entries(next.connections).map(([id, c]) => [id, { ...c, remember: false }])) };
      publish(temporary); return false;
    }
  };
  const active = state.tag === tag ? state : { ...empty(), tag };
  const requireCurrent = () => { if (currentTag.current !== tag || stateRef.current.tag !== tag || loadedTag !== tag) throw new Error('The account or family changed. Wait for AI settings to unlock, then reconnect.'); };
  return <Context.Provider value={{ ...active, ready: state.tag === tag && loadedTag === tag, notice,
    select: provider => {
      requireCurrent(); cancelAIRequests(); const next = { ...stateRef.current, selected: provider }; publish(next);
      void persist(next).catch(() => { /* scope changes intentionally cancel persistence */ });
    },
    connect: async value => {
      requireCurrent(); const connection = connectionSchema.parse({ ...value, remember: w.mode === 'account' && !!w.identity && value.remember });
      cancelAIRequests(); const next = { tag, selected: connection.provider, connections: { ...stateRef.current.connections, [connection.provider]: connection } };
      publish(next); const stored = await persist(next); return connection.remember && stored;
    },
    disconnect: async provider => {
      requireCurrent(); cancelAIRequests(); const connections = { ...stateRef.current.connections }; delete connections[provider];
      const next = { ...stateRef.current, connections }; publish(next); await persist(next);
    },
  }}>{children}</Context.Provider>;
}

export function useAIConnections() { const value = useContext(Context); if (!value) throw new Error('AI connections provider missing.'); return value; }
