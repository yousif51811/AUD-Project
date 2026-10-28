import { t, useLanguage } from '@/i18n';
import { useLayoutEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

let lockCount = 0;
function lockScroll() {
  lockCount += 1;
  document.documentElement.style.overflow = 'hidden';
}
function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.documentElement.style.overflow = '';
}

const FOCUSABLE = 'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  description?: string;
  /** Alert-style dialog for destructive confirmations */
  alert?: boolean;
  className?: string;
  returnFocus?: HTMLElement | null;
}

/** Accessible modal dialog with focus trap, Escape to close and focus restoration. */
export function Modal({ open, title, onClose, children, footer, wide, description, alert, className, returnFocus }: Props) {
  useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return;
    const previous = returnFocus ?? (document.activeElement as HTMLElement | null);
    lockScroll();
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      unlockScroll();
      // Layout cleanup precedes removal of the auth backdrop's inert attribute.
      // Restore after that commit, without stealing focus from a replacement dialog.
      queueMicrotask(() => {
        const dialog = document.querySelector('[aria-modal="true"]');
        if (previous && document.contains(previous) && !previous.closest('[inert]') && (!dialog || dialog.contains(previous))) previous.focus();
      });
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={`modal${wide ? ' modal-wide' : ''}${className ? ' ' + className : ''}`}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div className="stack stack-sm">
            <h2 id={titleId} style={{ fontSize: 'var(--fs-xl)' }}>{typeof title === 'string' ? t(title) : title}</h2>
            {description && <p id={descId} className="muted small">{t(description)}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t("Close dialog")}><X size={20} aria-hidden /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
