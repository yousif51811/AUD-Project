import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { googleAuthError } from '@/lib/google-auth';
import { t, useLanguage } from '@/i18n';

function GoogleMark() {
  return <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.58-4.1H3.08v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.42 13.94a6 6 0 0 1 0-3.88v-2.6H3.08a10 10 0 0 0 0 9.08l3.34-2.6Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.92 5.46l3.34 2.6A6 6 0 0 1 12 5.96Z"/></svg>;
}
function useGoogleAvailability() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth-options', {cache:'no-store', credentials:'same-origin', signal:controller.signal})
      .then(async response => response.ok && (await response.json()).google === true)
      .then(setAvailable).catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, []);
  return available;
}
function useGoogleCallbackError() {
  const { search } = useLocation(), query = new URLSearchParams(search);
  return query.get('google') === 'error' ? googleAuthError(query.get('error')) : '';
}

export function GoogleSignIn({ signup, invitationToken, readEnrollment, disabled, onPending }: {
  signup: boolean; invitationToken?: string; readEnrollment: () => {ageGroup:string; relationship:string}; disabled: boolean; onPending: (value:boolean) => void;
}) {
  useLanguage();
  const available = useGoogleAvailability(), callbackError = useGoogleCallbackError();
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { setError(''); }, [signup]);
  const connect = async () => {
    if (!available || disabled || pending) return;
    controller.current = new AbortController(); setError(''); setPending(true); onPending(true);
    const callbackURL = invitationToken ? '/invitations/' + encodeURIComponent(invitationToken) : '/account';
    const errorCallbackURL = (invitationToken ? callbackURL : signup ? '/sign-up' : '/sign-in') + '?google=error';
    try {
      const response = await authClient.signIn.social({provider:'google', callbackURL, newUserCallbackURL:callbackURL, errorCallbackURL,
        requestSignUp:signup, ...(signup ? {additionalData:{...readEnrollment(), ...(invitationToken ? {invitationToken} : {})}} : {})}, {signal:controller.current.signal});
      if (response.error) setError(googleAuthError(response.error.code));
    } catch { if (!controller.current.signal.aborted) setError(googleAuthError()); }
    finally { if (!controller.current.signal.aborted) { setPending(false); onPending(false); } }
  };
  return <div className="google-auth stack stack-sm">
    <button type="button" className="btn btn-secondary google-button" disabled={disabled || pending || available !== true} aria-busy={pending || available === null} onClick={() => void connect()}><GoogleMark/>{pending ? t('Opening Google…') : t('Continue with Google')}</button>
    {available === null ? <p className="hint" role="status">{t('Checking Google sign-in…')}</p> : !available ? <p className="hint">{t('Google sign-in is not enabled on this site yet. You can use email below.')}</p> : <p className="hint">{signup ? t('Google supplies your name and email. Choose your age group below first; children and teens need an adult invitation.') : t('Google signs you in. Your encrypted vault still unlocks separately.')}</p>}
    {(error || callbackError) && <p className="notice notice-safety" role="alert">{t(error || callbackError)}</p>}
    <div className="auth-divider"><span/>{t('or use email')}<span/></div>
  </div>;
}

/** Linking requires an existing authenticated session and the same Google email. */
export function GoogleAccountConnection() {
  useLanguage();
  const available = useGoogleAvailability(), callbackError = useGoogleCallbackError();
  const linkController = useRef<AbortController | null>(null);
  useEffect(() => () => linkController.current?.abort(), []);
  const [connected, setConnected] = useState<boolean | null>(null), [pending, setPending] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/list-accounts', {cache:'no-store', credentials:'same-origin', signal:controller.signal})
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(accounts => { if (!Array.isArray(accounts)) throw new Error(); setConnected(accounts.some(account => account.providerId === 'google')); })
      .catch(() => { if (!controller.signal.aborted) { setConnected(null); setError('Connected sign-in methods could not be checked. Please reload before linking Google.'); } });
    return () => controller.abort();
  }, []);
  const link = async () => {
    if (!available || pending || connected === null) return;
    linkController.current = new AbortController(); setPending(true); setError('');
    try {
      const response = await authClient.linkSocial({provider:'google',callbackURL:'/account',errorCallbackURL:'/account?google=error'}, {signal:linkController.current.signal});
      if (response.error) setError(googleAuthError(response.error.code));
    } catch { if (!linkController.current.signal.aborted) setError(googleAuthError()); }
    finally { if (!linkController.current.signal.aborted) setPending(false); }
  };
  return <section className="daily-paper stack google-account" aria-labelledby="google-account-title">
    <div className="cluster"><GoogleMark/><h2 id="google-account-title">{t('Sign-in methods')}</h2></div>
    {connected ? <p className="cluster"><Check size={17} aria-hidden/>{t('Google is connected to this account.')}</p> : <><p className="hint">{t('Already use email? Link the same Google email while signed in to keep one account and your existing vault.')}</p><button type="button" className="btn btn-secondary google-button" disabled={available !== true || connected === null || pending} aria-busy={pending} onClick={() => void link()}>{pending ? t('Opening Google…') : t('Link Google to this account')}</button></>}
    {available === false && <p className="hint">{t('Google sign-in is not enabled on this site yet.')}</p>}
    <p className="hint">{t('Google never unlocks your vault or grants family access. Your vault passphrase and invitation approvals still apply.')}</p>
    {(error || callbackError) && <p className="notice notice-safety" role="alert">{t(error || callbackError)}</p>}
  </section>;
}
