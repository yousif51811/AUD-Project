import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Tone = 'ok' | 'warn' | 'error';
interface ToastItem { id: number; message: string; tone: Tone; action?: { label: string; run: () => void } }
interface ToastApi { toast: (message: string, tone?: Tone, action?: ToastItem['action']) => void }

const Ctx = createContext<ToastApi>({ toast: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((x) => x.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { window.clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, tone: Tone = 'ok', action?: ToastItem['action']) => {
    idRef.current += 1;
    const id = idRef.current;
    setItems((x) => [...x.slice(-2), { id, message, tone, action }]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), action ? 9000 : 5000));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => window.clearTimeout(t)); map.clear(); };
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            {t.action && <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
