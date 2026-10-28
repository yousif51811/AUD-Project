import { t, useLanguage } from '@/i18n';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { useWorkspace } from '@/workspace/Workspace';
import { api } from '@/workspace/transport';
import { useApp } from '@/state/store';
import { demoProfile } from '@/data/demo';
import type { FamilySummary } from '@/shared/contracts';
import { GoogleAccountConnection } from '@/components/family/GoogleAuth';
import { AuthenticationForm, AuthLink } from '@/components/family/AuthDialog';
export default function Account() {
  useLanguage();
    const w = useWorkspace(), app = useApp(), nav = useNavigate(), location = useLocation(), params = useParams();
    const [sessions, setSessions] = useState<Array<{
        token: string;
        userAgent?: string | null;
        expiresAt: Date;
    }>>([]);
    const [signup, setSignup] = useState(location.pathname === '/sign-up' || !!params.token), [error, setError] = useState(''), [busy, setBusy] = useState(false), [recovery, setRecovery] = useState(''), [hasVault, setHasVault] = useState<boolean | null>(null), [useRecovery, setUseRecovery] = useState(false), [name, setName] = useState('');
    useEffect(() => { if (w.user)
        void api('identity').then(v => setHasVault(!!v)).catch(e => setError(e.message)); }, [w.user]);
    const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const createFamily = async () => {
        const f = await api<{
            id: string;
        }>('families', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        const profile = demoProfile();
        profile.id = f.id;
        profile.name = name.trim() || 'Our family';
        profile.isDemo = false;
        profile.members = [{ ...profile.members[0], id: w.user!.id, name: w.user!.name, ageGroup: (w.user!.ageGroup ?? 'adult') as 'adult', role: 'Family member' }];
        const me = { userId: w.user!.id, publicKey: w.identity!.publicKey, signingKey: w.identity!.signingKey, role: 'OWNER', status: 'ACTIVE', ageGroup: w.user!.ageGroup ?? 'adult' };
        const { encryptRecord } = await import('@/lib/vault/crypto');
        const record = await encryptRecord({ id: f.id + ':slice-profile', familyId: f.id, kind: 'profile', version: 1, authorId: w.user!.id, senderId: w.user!.id, editorIds: [w.user!.id], recipients: [me], payload: { data: { ...profile, audience: 'family' }, cloudAllowed: false } }, w.identity!);
        await api('records', record);
        await w.refresh();
        const list = await api<FamilySummary[]>('families');
        void list;
        try { sessionStorage.setItem('familymind:walkthrough', 'show'); } catch { /* optional walkthrough; account setup can continue */ }
        setName('');
        setError('Family created. Choose Open family space above to continue.');
    };
    return <section className="account-page stack stack-lg"><Link className="family-text-link" to="/">{t("← FamilyMind home")}</Link><header className="planner-heading"><div><p className="planner-date">{t("A place for your people")}</p><h1>{w.user ? t("Your private family space") : signup ? t("Make room for family.") : t("Welcome back.")}</h1><p>{t("Fictional-data prototype · individual accounts · encrypted family content.")}</p></div></header>
 {error && <p role="alert" className="notice notice-safety">{t(error)}</p>}
 {!w.user ? params.token ? <section className="daily-paper stack"><AuthenticationForm signup={signup} invitationToken={params.token} onSwitch={() => setSignup(x => !x)}/></section> : <section className="daily-paper account-entry"><span className="paper-label">{t("YOUR PEOPLE, ONE SHARED SPACE")}</span><h2>{t("Come on in.")}</h2><p>{t("Sign in to unlock your family’s week, or make yourself at home with our sample family.")}</p><div className="cluster"><AuthLink className="btn btn-primary">{t("Sign in")}</AuthLink><AuthLink to="/sign-up" className="btn btn-secondary">{t("Create account")}</AuthLink><Link to="/demo" className="family-text-link">{t("Explore the sample family →")}</Link></div></section> :
            !w.identity ? <section className="daily-paper stack"><h2>{hasVault===null?t("Checking your vault…"):hasVault === false ? t("Create your encrypted vault") : t("Unlock your vault")}</h2><p>{t("Your family content is encrypted before it leaves this device. We cannot recover your vault passphrase for you.")}</p><form className="stack" onSubmit={e => { e.preventDefault(); const secret = String(new FormData(e.currentTarget).get('secret')); void run(async () => { if (hasVault === false) {
                setRecovery(await w.createVault(secret));
                setHasVault(true);
            }
            else
                await w.unlock(secret, useRecovery); }); }}><label className="field">{useRecovery ? t("Recovery code") : t("Vault passphrase")}<input name="secret" className="input" type="password" required minLength={useRecovery ? 1 : 12} autoComplete="off"/></label><button className="btn btn-primary" disabled={busy || hasVault === null}>{busy ? t("Unlocking…") : hasVault === false ? t("Create vault") : t("Unlock")}</button></form>{hasVault && <label><input type="checkbox" checked={useRecovery} onChange={e => setUseRecovery(e.target.checked)}/>{t(" Use my recovery code")}</label>}</section> :
                <><section className="daily-paper stack"><h2>{t("Hello, ")}{w.user.name}.</h2>{recovery && <div className="notice notice-safety stack"><strong>{t("Save this recovery code privately. It is shown only now.")}</strong><code style={{ overflowWrap: 'anywhere' }}>{recovery}</code><button className="btn btn-secondary" onClick={() => setRecovery('')}>{t("I have saved it")}</button></div>}
 <p>{t("Your vault is unlocked for this session.")}</p><div className="stack">{w.families.map(f => <button key={f.id} className="btn btn-secondary" disabled={f.status !== 'ACTIVE'} onClick={() => { w.selectFamily(f.id); w.exitDemo(); nav('/dashboard'); }}>{t("Open family space · ")}{f.role.toLowerCase()} {f.status === 'PENDING' ? t("— awaiting approval") : ''}</button>)}</div>
 {params.token ? <button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { await api('join', { token: params.token }); await w.refresh(); setError('Invitation accepted. Ask the family owner to approve encrypted access.'); })}>{t("Accept family invitation")}</button> : null}
 {['adult', 'older'].includes(w.user.ageGroup ?? 'adult') && <form className="stack" onSubmit={e => { e.preventDefault(); void run(createFamily); }}><label className="field">{t("Create a household")}<input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t("Our family")} maxLength={80}/></label><button className="btn btn-primary" disabled={busy}>{t("Create family")}</button></form>}
 <details><summary>{t("Your active sessions")}</summary><button className="btn btn-secondary" onClick={() => void run(async () => { const response = await authClient.listSessions(); if (response.error)
                    throw new Error('Sessions could not be loaded.'); setSessions(response.data ?? []); })}>{t("Refresh sessions")}</button>{sessions.map((session, i) => <div className="card stack" key={session.token}><p>{t("Session ")}{i + 1} · {session.userAgent?.slice(0, 100) ?? 'Browser'}{t(" · expires ")}{new Date(session.expiresAt).toLocaleDateString()}</p><button className="btn btn-ghost" onClick={() => void run(async () => { await authClient.revokeSession({ token: session.token }); setSessions(xs => xs.filter(x => x.token !== session.token)); })}>{t("Revoke this session")}</button></div>)}</details>
 <details><summary>{t("Delete my account")}</summary><p>{t("Transfer ownership or delete any family you own first. Private authored records and the encrypted vault backup will be removed; public verification keys remain for historical shared records.")}</p><form className="stack" onSubmit={e=>{e.preventDefault();const confirmation=String(new FormData(e.currentTarget).get('confirmation'));void run(async()=>{await api('account',{confirmation},'DELETE');await w.signOut();nav('/');});}}><label className="field">{t("Type DELETE to confirm")}<input name="confirmation" className="input" required/></label><button className="btn btn-secondary">{t("Delete account")}</button></form></details>
                <p className="hint">{t("Joining another family? Open the invitation link its owner shared with you.")}</p><button className="btn btn-ghost" onClick={() => void w.signOut().then(() => nav('/'))}>{t("Sign out and lock vault")}</button></section></>}
 {w.user && <GoogleAccountConnection/>}
 {w.mode === 'demo' && w.user && <button className="btn btn-secondary" onClick={() => w.exitDemo()}>{t("Return to my account")}</button>}
 <span hidden>{app.profile?.name}</span>
 </section>;
}
