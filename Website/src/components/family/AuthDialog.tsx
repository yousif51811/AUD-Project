import { t, useLanguage } from '@/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, HeartHandshake, House, LockKeyhole } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { CourtyardDrawing } from './LivingGarden';
import { GoogleSignIn } from './GoogleAuth';
import { LanguageControl } from './LanguageControl';
import { useWorkspace } from '@/workspace/Workspace';

// Capture before the route makes its background inert (which clears browser focus).
let authTrigger: HTMLElement | null = null;
export function AuthLink({ to = '/sign-in', children, className, onClick, replace }: { to?: '/sign-in' | '/sign-up'; children: ReactNode; className?: string; onClick?: () => void; replace?: boolean }) {
  useLanguage();
  const location = useLocation();
  const background = authBackground(location);
  return <Link to={to} state={{ authBackground: background }} replace={replace} className={className} onClick={event => {
    const link = event.currentTarget;
    const menuTrigger = link.closest('[role="dialog"]') ? Array.from(document.querySelectorAll<HTMLElement>('.family-header [aria-haspopup="dialog"][aria-expanded="true"]')).find(el => el.offsetParent !== null) : null;
    authTrigger = menuTrigger ?? link; onClick?.();
  }} aria-haspopup="dialog">{children}</Link>;
}
export function authBackground(location: Location): Location {
  const background = location.state?.authBackground as Location | undefined;
  if (background && typeof background.pathname === 'string' && background.pathname.startsWith('/') && !['/sign-in', '/sign-up'].includes(background.pathname)) return background;
  return ['/sign-in', '/sign-up'].includes(location.pathname) ? { ...location, pathname: '/', search: '', hash: '', state: null } : location;
}

export function AuthenticationForm({ signup, invitationToken, onSwitch }: { signup: boolean; invitationToken?: string; onSwitch: () => void }) {
  useLanguage();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [visible, setVisible] = useState(false);
  const helpId = useId(), panelId = useId(), tabs = useRef<HTMLDivElement>(null), focusTab = useRef(false);
  const controller = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => { setError(''); setVisible(false); form.current?.reset(); if (focusTab.current) { tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(); focusTab.current = false; } return () => controller.current?.abort(); }, [signup]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const request = new AbortController(); controller.current = request; setBusy(true); setError('');
    try {
      const body = { email: String(data.get('email')).trim(), password: String(data.get('password')), ...(signup ? { name: `${String(data.get('first')).trim()} ${String(data.get('last')).trim()}`, ageGroup: data.get('ageGroup'), relationship: data.get('relationship'), invitationToken } : {}) };
      const response = await fetch(`/api/auth/${signup ? 'sign-up' : 'sign-in'}/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body), signal: request.signal });
      if (!response.ok) {
        if (!signup) throw new Error(response.status === 429 ? 'Too many attempts. Please wait a moment before trying again.' : 'We could not sign you in. Check your email and password.');
        const result = await response.json(); throw new Error(result.message ?? 'Account could not be created.');
      }
      if (!request.signal.aborted) window.location.assign(invitationToken ? '/invitations/' + encodeURIComponent(invitationToken) : '/account');
    } catch (e) { if (!request.signal.aborted) setError((e as Error).message); }
    finally { if (!request.signal.aborted) setBusy(false); }
  };
  return <div className="auth-form-content">
    <div ref={tabs} className="auth-switch" role="tablist" aria-label={t("Account access")} onKeyDown={event => { if (busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? false : event.key === 'End' ? true : !signup; if (next !== signup) { focusTab.current = true; onSwitch(); } }}><button type="button" id={panelId + '-signin'} role="tab" aria-controls={panelId} aria-selected={!signup} tabIndex={signup ? -1 : 0} onClick={() => signup && onSwitch()} disabled={busy}>{t("Sign in")}</button><button type="button" id={panelId + '-signup'} role="tab" aria-controls={panelId} aria-selected={signup} tabIndex={signup ? 0 : -1} onClick={() => !signup && onSwitch()} disabled={busy}>{t("Create account")}</button></div>
    <div className="auth-fields" id={panelId} role="tabpanel" aria-labelledby={panelId + (signup ? '-signup' : '-signin')}>
    <p className="auth-intro">{signup ? t("A shared space starts with you. Invite your people once you’re settled in.") : t("Your shared week, small wins and favourite people are waiting.")}</p>
    <GoogleSignIn signup={signup} invitationToken={invitationToken} disabled={busy} onPending={setBusy} readEnrollment={() => {const fields = form.current ? new FormData(form.current) : null; return {ageGroup:String(fields?.get('ageGroup') ?? 'adult'),relationship:String(fields?.get('relationship') ?? '')};}}/>
    {error && <p role="alert" className="notice notice-safety">{t(error)}</p>}
    <form ref={form} className="stack auth-form" onSubmit={e => void submit(e)} aria-busy={busy}>
      {signup && <><div className="grid grid-2"><label className="field">{t("First name")}<input data-autofocus className="input" name="first" required autoComplete="given-name" maxLength={60}/></label><label className="field">{t("Last name")}<input className="input" name="last" required autoComplete="family-name" maxLength={60}/></label></div><div className="grid grid-2"><label className="field">{t("Age group")}<select className="select" name="ageGroup"><option value="adult">{t("Adult")}</option><option value="older">{t("Older adult")}</option><option value="teen">{t("Teenager — invited")}</option><option value="child">{t("Child — invited")}</option></select></label><label className="field">{t("Relationship (optional)")}<input className="input" name="relationship" placeholder={t("Parent, sibling…")} maxLength={80}/></label></div></>}
      <label className="field">{t("Email")}<input data-autofocus={!signup ? '' : undefined} className="input" name="email" dir="ltr" type="email" required autoComplete="email" placeholder={t("you@example.com")}/></label>
      <label className="field">{t("Password")}<span className="auth-password"><input className="input" name="password" aria-label={t("Password")} aria-describedby={helpId} type={visible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete={signup ? 'new-password' : 'current-password'}/><button type="button" aria-label={visible ? t("Hide password") : t("Show password")} aria-pressed={visible} onClick={() => setVisible(x => !x)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
      <span id={helpId} className="hint">{signup ? t("At least 12 characters. Children and teenagers need an adult’s invitation.") : t("Your account password, separate from your vault passphrase.")}</span>
      <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden/>{t("Please wait…")}</> : <>{signup ? t("Create account") : t("Sign in")}<ArrowRight size={18}/></>}</button>
    </form>
    <div className="auth-reassurance"><LockKeyhole size={16} aria-hidden/><p>{t("Family content is encrypted on your device.")}<span>{t("You’ll unlock your separate vault after signing in.")}</span></p></div>
    <p className="auth-demo">{t("Just looking around? ")}<Link to="/demo">{t("Meet the sample family ")}<ArrowRight size={13}/></Link></p>
    <details className="auth-help"><summary>{t("Need help accessing your account?")}</summary><p>{t("This prototype has no password-reset email service. Your vault recovery code restores encryption keys, not your account password. Use fictional data for the demonstration.")}</p></details>
    </div>
  </div>;
}

export function AuthDialog() {
  useLanguage();
  const location = useLocation(), navigate = useNavigate(), w = useWorkspace();
  const returnFocus = useRef(authTrigger);
  useEffect(() => { authTrigger = null; }, []);
  const signup = location.pathname === '/sign-up', background = authBackground(location);
  if (w.user) return <Navigate to="/account" replace/>;
  return <Modal open returnFocus={returnFocus.current} title={signup ? t("Make room for family.") : t("Welcome back.")} className="auth-modal" onClose={() => navigate(background.pathname + background.search + background.hash, { replace: true })}>
    <aside className="auth-story" aria-label={t("A place for your people")}><span className="auth-wordmark"><House size={23} aria-hidden/>{t("familymind.")}</span><div><span className="auth-eyebrow">{t("A PLACE FOR YOUR PEOPLE")}</span><h3>{t("Less to carry.")}<br/><em>{t("More to share.")}</em></h3><p>{t("For the everyday things")}<br/>{t("that bring us together.")}</p></div><CourtyardDrawing/><span className="auth-story-note"><HeartHandshake size={18} aria-hidden/>{t("A little more together, every day.")}</span></aside>
    <div className="auth-form-panel"><div className="auth-language"><LanguageControl expanded/></div><AuthenticationForm signup={signup} onSwitch={() => navigate(signup ? '/sign-in' : '/sign-up', { replace: true, state: { authBackground: background } })}/></div>
  </Modal>;
}
