import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Info, ShieldAlert, Sparkles } from 'lucide-react';
import type { FamilyMember, Recommendation } from '@/types';
import { STANDARD_DISCLAIMER } from '@/lib/safety';

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

export function MemberAvatar({ member, size = 40 }: { member: Pick<FamilyMember, 'name' | 'color'>; size?: number }) {
  return (
    <span className={`avatar c-${member.color}`} style={{ ['--sz' as string]: `${size}px` }} aria-hidden="true">
      {initials(member.name)}
    </span>
  );
}

export function AvatarStack({ members }: { members: FamilyMember[] }) {
  return (
    <span className="avatar-stack" role="img" aria-label={`Household members: ${members.map((m) => m.name).join(', ')}`}>
      {members.map((m) => <MemberAvatar key={m.id} member={m} size={36} />)}
    </span>
  );
}

export function namesOf(ids: string[], members: FamilyMember[], all = 'Whole household'): string {
  if (ids.length === 0) return all;
  if (members.length > 0 && ids.length >= members.length && members.every((m) => ids.includes(m.id))) return 'Whole household';
  return ids.map((id) => members.find((m) => m.id === id)?.name ?? 'Member').join(', ');
}

export function SectionHeading({ eyebrow, title, lede, center, as: H = 'h2', id }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; center?: boolean; as?: 'h1' | 'h2'; id?: string }) {
  return (
    <div className={`stack${center ? ' center' : ''}`} style={{ maxWidth: 760, ...(center ? { alignItems: 'center' } : {}) }}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <H id={id}>{title}</H>
      {lede && <p className="lede">{lede}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="stack stack-sm" style={{ minWidth: 0 }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 tabIndex={-1} data-page-heading>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="cluster page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, message, actions }: { icon?: ReactNode; title: string; message: string; actions?: ReactNode }) {
  return (
    <div className="state-box">
      <span className="state-icon" aria-hidden>{icon ?? <Sparkles size={26} />}</span>
      <h2 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h2>
      <p className="muted">{message}</p>
      {actions && <div className="cluster" style={{ justifyContent: 'center' }}>{actions}</div>}
    </div>
  );
}

export function SafetyNotice({ children, tone = 'safety', title }: { children?: ReactNode; tone?: 'safety' | 'info' | 'danger'; title?: string }) {
  const cls = tone === 'danger' ? 'notice notice-danger' : tone === 'info' ? 'notice' : 'notice notice-safety';
  return (
    <div className={cls} role={tone === 'danger' ? 'alert' : 'note'}>
      {tone === 'info' ? <Info size={20} aria-hidden /> : <ShieldAlert size={20} aria-hidden />}
      <div>{title && <strong>{title} </strong>}{children ?? STANDARD_DISCLAIMER}</div>
    </div>
  );
}

export function Disclosure({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="disclosure">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span><ChevronDown size={20} aria-hidden />
      </button>
      {open && <div className="disclosure-body" id={id}>{children}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled, name }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean; name?: string }) {
  const id = useId();
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} name={name} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-describedby={description ? `${id}-d` : undefined} />
      <span className="switch-track" aria-hidden />
      <span className="switch-text">
        <span className="label">{label}</span>
        {description && <span className="hint" id={`${id}-d`}>{description}</span>}
        <span className={`switch-state${checked ? '' : ' off'}`}>{checked ? 'On' : 'Off'}</span>
      </span>
    </label>
  );
}

export function ChoiceCard({ type = 'radio', name, value, checked, onChange, label, hint, disabled }: { type?: 'radio' | 'checkbox'; name: string; value: string; checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`choice${type === 'checkbox' ? ' is-check' : ''}`}>
      <input type={type} name={name} value={value} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="choice-body">
        <span className="choice-mark"><Check size={14} strokeWidth={3} aria-hidden /></span>
        <span><span className="choice-label">{label}</span>{hint && <><br /><span className="choice-hint">{hint}</span></>}</span>
      </span>
    </label>
  );
}

export function MetricCard({ label, value, hint, icon, tone = 'blue', to }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: string; to?: string }) {
  const body = (
    <>
      {icon && <span className={`card-icon ${tone}`} aria-hidden>{icon}</span>}
      <span className="metric-text">
        <span className="metric-label">{label}</span>
        <span className="metric-value num">{value}</span>
        {hint && <span className="metric-hint">{hint}</span>}
      </span>
    </>
  );
  return to ? <a className="metric card card-hover" href={to}>{body}</a> : <div className="metric card">{body}</div>;
}

/** Shows signal → pattern → explanation → action → control for any recommendation. */
export function ExplainabilityPanel({ rec, defaultOpen = false }: { rec: Recommendation; defaultOpen?: boolean }) {
  return (
    <Disclosure title="Why this recommendation?" defaultOpen={defaultOpen}>
      <ol className="explain-flow">
        <li><span className="explain-k">Reported signals</span><span>{rec.signals.join(' · ')}</span></li>
        <li><span className="explain-k">Connected pattern</span><span>{rec.pattern}</span></li>
        <li><span className="explain-k">Explanation</span><span>{rec.why}</span></li>
        <li><span className="explain-k">Why this action</span><span>{rec.whyAction}</span></li>
        <li><span className="explain-k">Who decides</span><span>{rec.control}</span></li>
        <li><span className="explain-k">Time needed</span><span>About {rec.minutes} minutes</span></li>
        <li><span className="explain-k">Alternative</span><span>{rec.alternative}</span></li>
      </ol>
    </Disclosure>
  );
}
