import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { useWorkspace } from '@/workspace/Workspace';
import { api } from '@/workspace/transport';
import { useApp } from '@/state/store';
import { demoProfile } from '@/data/demo';
import type { FamilySummary } from '@/shared/contracts';
export default function Account() {
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
    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        void run(async () => {
            const email = String(form.get('email')).trim(), password = String(form.get('password'));
            if (signup) {
                const first = String(form.get('first')).trim(), last = String(form.get('last')).trim();
                const response = await fetch('/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email, password, name: first + ' ' + last, ageGroup: form.get('ageGroup'), relationship: form.get('relationship'), invitationToken: params.token }) });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.message ?? 'Account could not be created.');
                }
            }
            else {
                const result = await authClient.signIn.email({ email, password });
                if (result.error)
                    throw new Error('We could not sign you in. Check your email and password.');
            }
            window.location.assign(params.token ? '/invitations/' + params.token : '/account');
        });
    };
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
        sessionStorage.setItem('familymind:walkthrough', 'show');
        setName('');
        setError('Family created. Choose Open family space above to continue.');
    };
    return <section className="account-page stack stack-lg"><Link className="family-text-link" to="/">← FamilyMind home</Link><header className="planner-heading"><div><p className="planner-date">A place for your people</p><h1>{w.user ? 'Your private family space' : signup ? 'Make room for family.' : 'Welcome back.'}</h1><p>Fictional-data prototype · individual accounts · encrypted family content.</p></div></header>
 {error && <p role="alert" className="notice notice-safety">{error}</p>}
 {!w.user ? <section className="daily-paper stack"><form className="stack" onSubmit={submit}>
  {signup && <><div className="grid grid-2"><label className="field">First name<input className="input" name="first" required autoComplete="given-name" maxLength={60}/></label><label className="field">Last name<input className="input" name="last" required autoComplete="family-name" maxLength={60}/></label></div>
  <label className="field">Age group<select className="select" name="ageGroup"><option value="adult">Adult</option><option value="older">Older adult</option><option value="teen">Teenager — invitation required</option><option value="child">Child — invitation required</option></select></label><label className="field">Relationship (optional)<input className="input" name="relationship" placeholder="Parent, sibling, grandparent…" maxLength={80}/></label></>}
  <label className="field">Email<input className="input" name="email" type="email" required autoComplete="email"/></label><label className="field">Password<input className="input" name="password" aria-label="Password" aria-describedby="password-help" type="password" minLength={12} maxLength={128} required autoComplete={signup ? 'new-password' : 'current-password'}/><span id="password-help" className="hint">At least 12 characters. Separate from your vault passphrase.</span></label>
  <button className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button></form><button className="btn btn-ghost" onClick={() => setSignup(!signup)}>{signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</button><Link className="btn btn-secondary" to="/demo">Explore without signing in</Link><p className="hint">Email delivery is optional in this prototype. Password-reset emails are not available without a mail service; vault recovery restores encryption keys, not your account password.</p></section> :
            !w.identity ? <section className="daily-paper stack"><h2>{hasVault===null?'Checking your vault…':hasVault === false ? 'Create your encrypted vault' : 'Unlock your vault'}</h2><p>Your family content is encrypted before it leaves this device. We cannot recover your vault passphrase for you.</p><form className="stack" onSubmit={e => { e.preventDefault(); const secret = String(new FormData(e.currentTarget).get('secret')); void run(async () => { if (hasVault === false) {
                setRecovery(await w.createVault(secret));
                setHasVault(true);
            }
            else
                await w.unlock(secret, useRecovery); }); }}><label className="field">{useRecovery ? 'Recovery code' : 'Vault passphrase'}<input name="secret" className="input" type="password" required minLength={useRecovery ? 1 : 12} autoComplete="off"/></label><button className="btn btn-primary" disabled={busy || hasVault === null}>{busy ? 'Unlocking…' : hasVault === false ? 'Create vault' : 'Unlock'}</button></form>{hasVault && <label><input type="checkbox" checked={useRecovery} onChange={e => setUseRecovery(e.target.checked)}/> Use my recovery code</label>}</section> :
                <><section className="daily-paper stack"><h2>Hello, {w.user.name}.</h2>{recovery && <div className="notice notice-safety stack"><strong>Save this recovery code privately. It is shown only now.</strong><code style={{ overflowWrap: 'anywhere' }}>{recovery}</code><button className="btn btn-secondary" onClick={() => setRecovery('')}>I have saved it</button></div>}
 <p>Your vault is unlocked for this session.</p><div className="stack">{w.families.map(f => <button key={f.id} className="btn btn-secondary" disabled={f.status !== 'ACTIVE'} onClick={() => { w.selectFamily(f.id); w.exitDemo(); nav('/dashboard'); }}>Open family space · {f.role.toLowerCase()} {f.status === 'PENDING' ? '— awaiting approval' : ''}</button>)}</div>
 {params.token ? <button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { await api('join', { token: params.token }); await w.refresh(); setError('Invitation accepted. Ask the family owner to approve encrypted access.'); })}>Accept family invitation</button> : null}
 {['adult', 'older'].includes(w.user.ageGroup ?? 'adult') && <form className="stack" onSubmit={e => { e.preventDefault(); void run(createFamily); }}><label className="field">Create a household<input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Our family" maxLength={80}/></label><button className="btn btn-primary" disabled={busy}>Create family</button></form>}
 <details><summary>Your active sessions</summary><button className="btn btn-secondary" onClick={() => void run(async () => { const response = await authClient.listSessions(); if (response.error)
                    throw new Error('Sessions could not be loaded.'); setSessions(response.data ?? []); })}>Refresh sessions</button>{sessions.map((session, i) => <div className="card stack" key={session.token}><p>Session {i + 1} · {session.userAgent?.slice(0, 100) ?? 'Browser'} · expires {new Date(session.expiresAt).toLocaleDateString()}</p><button className="btn btn-ghost" onClick={() => void run(async () => { await authClient.revokeSession({ token: session.token }); setSessions(xs => xs.filter(x => x.token !== session.token)); })}>Revoke this session</button></div>)}</details>
 <details><summary>Delete my account</summary><p>Transfer ownership or delete any family you own first. Private authored records and the encrypted vault backup will be removed; public verification keys remain for historical shared records.</p><form className="stack" onSubmit={e=>{e.preventDefault();const confirmation=String(new FormData(e.currentTarget).get('confirmation'));void run(async()=>{await api('account',{confirmation},'DELETE');await w.signOut();nav('/');});}}><label className="field">Type DELETE to confirm<input name="confirmation" className="input" required/></label><button className="btn btn-secondary">Delete account</button></form></details>
                <p className="hint">Joining another family? Open the invitation link its owner shared with you.</p><button className="btn btn-ghost" onClick={() => void w.signOut().then(() => nav('/'))}>Sign out and lock vault</button></section></>}
 {w.mode === 'demo' && w.user && <button className="btn btn-secondary" onClick={() => w.exitDemo()}>Return to my account</button>}
 <span hidden>{app.profile?.name}</span>
 </section>;
}
