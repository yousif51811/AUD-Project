import { t, useLanguage } from '@/i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { useWorkspace } from '@/workspace/Workspace';
import { api } from '@/workspace/transport';
import { demoProfile } from '@/data/demo';
import type { InvitationSummary } from '@/shared/contracts';
import { GoogleAccountConnection } from '@/components/family/GoogleAuth';
import { AuthenticationForm, AuthLink } from '@/components/family/AuthDialog';
export default function Account() {
    useLanguage();
    const w = useWorkspace(), nav = useNavigate(), params = useParams();
    const [signup, setSignup] = useState(!!params.token), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [name, setName] = useState(''), [useRecovery, setUseRecovery] = useState(false), [invitations, setInvitations] = useState<InvitationSummary[]>([]);
    const [sessions, setSessions] = useState<Array<{ token: string; userAgent?: string | null; expiresAt: Date }>>([]);
    const run = async (fn: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    useEffect(() => {
        if (!w.user) return;
        const load = () => void api<InvitationSummary[]>('invitations').then(setInvitations).catch(e => setError(e.message));
        load(); const timer = window.setInterval(load, 15000); return () => clearInterval(timer);
    }, [w.user]);
    const join = async (input: { token?: string; invitationId?: string }) => {
        await api('join', input); await w.refresh(); setInvitations([]);
    };
    const createFamily = async () => {
        const family = await api<{ id: string }>('families', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        const profile = demoProfile(); profile.id = family.id; profile.name = name.trim() || 'Our family'; profile.isDemo = false;
        profile.members = [{ ...profile.members[0], id: w.user!.id, name: w.user!.name, ageGroup: (w.user!.ageGroup ?? 'adult') as 'adult', role: 'Family member' }];
        const me = { userId: w.user!.id, publicKey: w.identity!.publicKey, signingKey: w.identity!.signingKey };
        const { encryptRecord } = await import('@/lib/vault/crypto');
        const record = await encryptRecord({ id: family.id + ':slice-profile', familyId: family.id, kind: 'profile', version: 1, authorId: w.user!.id, senderId: w.user!.id, editorIds: [w.user!.id], recipients: [me], payload: { data: { ...profile, audience: 'family' }, cloudAllowed: false } }, w.identity!);
        await api('records', record); await w.refresh();
        nav('/dashboard');
    };
    useEffect(() => { if (w.user && w.mode === 'demo') w.exitDemo(); }, [w]);
    const hasFamily = w.families.length > 0, pending = !w.families.some(f => f.status === 'ACTIVE') && w.families.some(f => f.status === 'PENDING');
    return <section className="account-page stack stack-lg">
        <Link className="family-text-link" to="/">{t('← FamilyMind home')}</Link>
        <header className="planner-heading"><div><p className="planner-date">{t('A place for your people')}</p><h1>{w.user ? t('Your account') : t('Welcome back.')}</h1><p>{t('One account. One family. A little less to carry.')}</p></div></header>
        {error && <p role="alert" className="notice notice-safety">{t(error)}</p>}
        {!w.user ? params.token ? <section className="daily-paper stack"><h2>{t('You’re invited to a family')}</h2><p>{t('Use the email this invitation was sent to. Create an account or sign in to join.')}</p><AuthenticationForm signup={signup} invitationToken={params.token} onSwitch={() => setSignup(x => !x)}/></section> : <section className="daily-paper stack"><h2>{t('Come on in.')}</h2><div className="cluster"><AuthLink className="btn btn-primary">{t('Sign in')}</AuthLink><AuthLink to="/sign-up" className="btn btn-secondary">{t('Create account')}</AuthLink><Link to="/demo">{t('Try the sample family')}</Link></div></section> : <>
            {w.loading ? <p role="status">{t('Getting your family space ready…')}</p> : !w.identity ? <section className="daily-paper stack"><h2>{t('Restore access on this device')}</h2><p>{t('Enter your account password. Older accounts may need their previous vault passphrase. Google accounts can use their saved recovery code.')}</p><form className="stack" onSubmit={e => { e.preventDefault(); const secret = String(new FormData(e.currentTarget).get('secret')); void run(() => w.unlock(secret, useRecovery)); }}><label className="field">{useRecovery ? t('Recovery code') : t('Password')}<input className="input" name="secret" type="password" autoComplete={useRecovery ? 'off' : 'current-password'} required/></label><label><input type="checkbox" checked={useRecovery} onChange={e => setUseRecovery(e.target.checked)}/> {t('Use my recovery code')}</label><button className="btn btn-primary" disabled={busy}>{t('Restore access')}</button></form><button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => w.completeSignIn())}>{t('Try again')}</button></section> : <>
                <section className="daily-paper stack"><h2>{t('Hello, ')}{w.user.name}.</h2>
                    {w.user.username ? <p dir="ltr" style={{ overflowWrap: 'anywhere' }}>@{w.user.username}</p> : <form className="stack" onSubmit={e => { e.preventDefault(); const username = String(new FormData(e.currentTarget).get('username')); void run(async () => { await api('username', { username }); await w.completeSignIn(); }); }}><label className="field">{t('Choose your username')}<input className="input" name="username" dir="ltr" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" autoComplete="username"/></label><p className="hint">{t('Your family can invite you using this name. 3–30 letters, numbers or underscores.')}</p><button className="btn btn-secondary" disabled={busy}>{t('Save username')}</button></form>}
                    {pending ? <div role="status" className="notice"><h3>{t('You’ve joined. One last step.')}</h3><p>{t('Ask the family owner to open Invite family and confirm your access. This page updates automatically.')}</p><button className="btn btn-secondary" onClick={() => void run(w.refresh)} disabled={busy}>{t('Check access')}</button></div> : hasFamily ? <><p>{t('Your family is ready.')}</p><div className="cluster"><button className="btn btn-primary" onClick={() => nav('/dashboard')}>{t('Go to my family')}</button><Link className="btn btn-secondary" to="/family#invite-family">{t('Invite family')}</Link></div></> : <>
                        {params.token ? <div className="stack"><h3>{t('You’re invited to a family')}</h3><p>{t('Join with the email the owner invited. They will then confirm your access to shared records.')}</p><button className="btn btn-primary" disabled={busy} onClick={() => void run(() => join({ token: params.token }))}>{t('Join family')}</button></div> : <>
                            {invitations.length > 0 && <div className="stack"><h3>{t('Your family invitations')}</h3>{invitations.map(invitation => <article className="card stack" key={invitation.id}><p>{invitation.inviter} · {invitation.role === 'VIEWER' ? t('Read-only') : t('Member')}</p><p className="hint">{t('Expires: ')}{new Date(invitation.expiresAt).toLocaleDateString()}</p><button className="btn btn-primary" disabled={busy} onClick={() => void run(() => join({ invitationId: invitation.id }))}>{t('Join family')}</button></article>)}</div>}
                            {['adult', 'older'].includes(w.user.ageGroup ?? 'adult') && <form className="stack" onSubmit={e => { e.preventDefault(); void run(createFamily); }}><h3>{t('Start your family space')}</h3><label className="field">{t('Family name (optional)')}<input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t('Our family')} maxLength={80}/></label><button className="btn btn-primary" disabled={busy}>{t('Create my family')}</button></form>}
                            <p className="hint">{t('Joining someone? Ask them to invite your username or email from Invite family. Your invitation will appear here, or you can open their link.')}</p>
                        </>}
                    </>}
                </section>
                <details className="daily-paper stack"><summary>{t('Recovery & this device')}</summary><p>{t('This browser remembers encrypted access while you stay signed in. Sign out on shared devices. Your account password is never saved here.')}</p>{w.recoveryCode && <><p>{t('Save this recovery code privately, especially if you use Google. It restores access on another device.')}</p><code dir="ltr" style={{ overflowWrap: 'anywhere' }}>{w.recoveryCode}</code></>}<p>{t('Existing vault passphrases and recovery codes still work. Family content remains encrypted on the server.')}</p></details>
            </>}
            <GoogleAccountConnection/>
            <details className="daily-paper stack"><summary>{t('Your active sessions')}</summary><button className="btn btn-secondary" onClick={() => void run(async () => { const response = await authClient.listSessions(); if (response.error) throw new Error('Sessions could not be loaded.'); setSessions(response.data ?? []); })}>{t('Refresh sessions')}</button>{sessions.map((session, i) => <div className="card stack" key={session.token}><p>{t('Session ')}{i + 1} · {session.userAgent?.slice(0, 100) ?? 'Browser'}</p><button className="btn btn-ghost" onClick={() => void run(async () => { await authClient.revokeSession({ token: session.token }); setSessions(xs => xs.filter(x => x.token !== session.token)); })}>{t('Revoke this session')}</button></div>)}</details>
            <details className="daily-paper stack"><summary>{t('Delete my account')}</summary><p>{t('Transfer ownership or delete any family you own first. Private authored records and the encrypted vault backup will be removed; public verification keys remain for historical shared records.')}</p><form className="stack" onSubmit={e => { e.preventDefault(); const confirmation = String(new FormData(e.currentTarget).get('confirmation')); void run(async () => { await api('account', { confirmation }, 'DELETE'); await w.signOut(); nav('/'); }); }}><label className="field">{t('Type DELETE to confirm')}<input name="confirmation" className="input" required/></label><button className="btn btn-secondary">{t('Delete account')}</button></form></details>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void run(async () => { await w.signOut(); nav('/'); })}>{t('Sign out')}</button>
        </>}
    </section>;
}
