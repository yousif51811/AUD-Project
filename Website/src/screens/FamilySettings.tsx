import { useDisplay } from '@/lib/display';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/workspace/Workspace';
import { useApp, initialState } from '@/state/store';
import { api } from '@/workspace/transport';
import { fingerprint, protectIdentity } from '@/lib/vault/crypto';
import { legacyImportRows } from '@/workspace/legacy';
import { AISettings } from '@/components/ai/AISettings';
export default function FamilySettings() {
    const w = useWorkspace(), app = useApp(), nav = useNavigate();
    const [error, setError] = useState(''), [invite, setInvite] = useState(''), [prints, setPrints] = useState<Record<string, string>>({}), [importPreview, setImportPreview] = useState<ReturnType<typeof initialState> | null>(null), [recovery, setRecovery] = useState('');
    const [display, setDisplay] = useDisplay(w.actorId);
    const owner = w.mode === 'demo' || w.family?.role === 'OWNER';
    useEffect(() => { void Promise.all(w.members.map(async (m) => [m.userId, await fingerprint(m)] as const)).then(values => setPrints(Object.fromEntries(values))).catch(() => { }); }, [w.members]);
    const run = async (fn: () => Promise<void>) => { setError(''); try {
        await fn();
    }
    catch (e) {
        setError((e as Error).message);
    } };
    const exportData = () => {
        void run(async () => { const value = w.mode === 'demo' ? { demo: true, profile: app.profile, plan: app.plan, schedule: app.schedule } : { format: 'familymind-encrypted-backup-v1', identity: await api('identity'), records: await api('records?familyId=' + encodeURIComponent(w.family!.id)) }; const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'familymind-backup.json'; a.click(); URL.revokeObjectURL(url); });
    };
    return <div className="stack stack-lg"><header className="planner-heading"><div><p className="planner-date">People, preferences and privacy</p><h1>Family & more.</h1><p>Choose what you share. Make this space work for your people.</p></div></header>{error && <p className="notice notice-safety" role="alert">{error}</p>}
 <section className="daily-paper stack"><h2>Your family</h2><p>{app.profile?.name ?? 'Our family'} · {w.family?.timezone ?? 'Fictional sample week'}</p>{w.mode === 'demo' ? <><p>Demo perspective: {app.profile?.members.find(m => m.id === w.actorId)?.name}. No real account is signed in to this sample.</p><Link className="btn btn-secondary" to="/demo">Switch sample member</Link></> : <><p>Account: {w.user?.name} · {w.family?.role.toLowerCase()}</p>{w.members.filter(m => m.status !== 'REVOKED').map(m => <article key={m.userId} className="card stack stack-sm"><strong>{app.profile?.members.find(p => p.id === m.userId)?.name ?? 'Family member'} · {m.ageGroup} · {m.status.toLowerCase()}</strong><span className="hint">Encryption fingerprint: {prints[m.userId] ?? 'Loading…'}</span>{owner && m.userId !== w.actorId && <div className="cluster">{m.status === 'PENDING' && <button className="btn btn-primary btn-sm" onClick={() => void run(() => w.approve(m.userId))}>Approve encrypted access</button>}{m.status === 'ACTIVE' && <><button className="btn btn-secondary btn-sm" onClick={() => void run(async () => { if (!confirm('Transfer family ownership to this adult?'))
        return; await api(`families/${w.family!.id}/members`, { userId: m.userId, operation: 'transfer' }); await w.refresh(); })}>Transfer ownership</button><button className="btn btn-ghost btn-sm" onClick={() => void run(async () => { if (!confirm('Remove future access? Previously downloaded content cannot be withdrawn.'))
        return; await api(`families/${w.family!.id}/members`, { userId: m.userId, operation: 'remove' }); await w.refresh(); })}>Remove member</button></>}</div>}</article>)}</>}
 {owner && w.mode === 'account' && <form className="stack" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const r = await api<{
        token: string;
    }>(`families/${w.family!.id}/invite`, { email: f.get('email'), ageGroup: f.get('age') }); setInvite(location.origin + '/invitations/' + r.token); }); }}><h3>Invite someone</h3><label className="field">Their email<input className="input" type="email" required name="email"/></label><label className="field">Age group<select name="age" className="select"><option value="adult">Adult</option><option value="older">Older adult</option><option value="teen">Teenager</option><option value="child">Child</option></select></label><button className="btn btn-primary">Create invitation link</button>{invite && <label className="field">Share this link privately (expires in 48 hours)<input className="input" readOnly value={invite} onFocus={e => e.target.select()}/></label>}</form>}
 </section>
 {owner && w.mode === 'account' && <section className="daily-paper stack"><h2>Household timezone</h2><form className="stack" onSubmit={e => { e.preventDefault(); const timezone = String(new FormData(e.currentTarget).get('timezone')); void run(async () => { await api(`families/${w.family!.id}/timezone`, { timezone }); await w.refresh(); }); }}><label className="field">IANA timezone<input className="input" name="timezone" defaultValue={w.family?.timezone} placeholder="Asia/Dubai" required/></label><button className="btn btn-secondary">Save timezone</button></form></section>}
 <AISettings />
 <section className="daily-paper stack"><h2>Display and connection preferences</h2><div className="cluster">{(['largeText', 'highContrast', 'reduceMotion'] as const).map(key => <label key={key}><input type="checkbox" checked={!!(display[key] ?? app.profile?.preferences[key])} onChange={e => setDisplay({ [key]: e.target.checked })}/> {key === 'largeText' ? 'Larger text' : key === 'highContrast' ? 'High contrast' : 'Reduce motion'}</label>)}</div><p className="hint">Light, Dark and device appearance remain available from the header and family menu.</p><Link to="/notifications" className="family-text-link">Notification preferences →</Link><button className="btn btn-secondary" onClick={() => { sessionStorage.setItem('familymind:walkthrough', 'show'); nav('/dashboard'); }}>Reopen walkthrough</button></section>
 <section className="daily-paper stack"><h2>Your data, your choice</h2><p>Personal check-ins and conversations are private by default. Family sharing does not permit external AI processing. Author approval and a request preview are required for cloud use.</p><p className="hint">Account and delivery metadata remain visible to the service. Encryption does not protect against compromised devices or malicious website code. This prototype has not received an independent security audit.</p><button className="btn btn-secondary" onClick={exportData}>Download {w.mode === 'demo' ? 'sample data' : 'encrypted backup'}</button>
 {w.mode === 'account' && <><details><summary>Import previous browser data</summary><p>Original browser data is never removed. Review the household and dates before importing.</p><button className="btn btn-secondary" onClick={() => { if (!localStorage.getItem('familymind:v1:profile')) {
            setError('No previous household was found in this browser.');
            return;
        } setImportPreview(initialState(localStorage)); }}>Preview old data</button>{importPreview && <div className="stack"><p>{importPreview.profile?.name ?? 'No household'} · {importPreview.schedule.length} events · {importPreview.memories.length} memories. Events and keepsakes import privately. Assignments map to you and dates to the current week. The entire original snapshot, including the old plan and care details, remains in a private encrypted archive.</p><button className="btn btn-primary" onClick={() => void run(async () => { const marker = w.family!.id + ':legacy-import:' + w.actorId; if (w.records.some(r => r.id === marker))
            throw new Error('This browser import was already completed.'); if (!importPreview.profile)
            throw new Error('No previous household found.'); await w.saveMany(legacyImportRows(importPreview, w.family!.id, w.actorId)); setImportPreview(null); })}>Import privately with these mappings</button></div>}</details>
 {w.records.filter(r => r.kind === 'import' && r.authorId === w.actorId).map(r => <details key={r.id}><summary>Read your imported archive</summary><pre className="context-preview">{JSON.stringify(r.data.legacyState, null, 2)}</pre></details>)}
 <details><summary>Change vault passphrase / replace recovery code</summary><form className="stack" onSubmit={e => { e.preventDefault(); const pass = String(new FormData(e.currentTarget).get('pass')); void run(async () => { const result = await protectIdentity(w.identity!, pass); await api('identity', { publicKey: w.identity!.publicKey, signingKey: w.identity!.signingKey, vault: result.vault }); setRecovery(result.recoveryCode); }); }}><label className="field">New vault passphrase<input className="input" name="pass" type="password" minLength={12} required/></label><button className="btn btn-secondary">Update protection</button>{recovery && <code style={{ overflowWrap: 'anywhere' }}>Save privately: {recovery}</code>}</form></details>
 <button className="btn btn-secondary" onClick={() => void w.signOut().then(() => nav('/'))}>Sign out and lock vault</button>
 <details><summary>Destructive actions</summary><p>These actions cannot be undone. Keep an encrypted backup first.</p><form className="stack" onSubmit={e => { e.preventDefault(); const confirmation = String(new FormData(e.currentTarget).get('confirmation')); void run(async () => { if (owner) {
            await api(`families/${w.family!.id}/delete`, { confirmation });
        }
        else
            await api('account', { confirmation }, 'DELETE'); await w.signOut(); nav('/'); }); }}><label className="field">Type {owner ? 'DELETE_FAMILY' : 'DELETE'}<input className="input" name="confirmation" required/></label><button className="btn btn-secondary">{owner ? 'Delete family workspace' : 'Delete account'}</button></form></details></>}
 </section><Link to="/trust" className="family-text-link">Read about security, privacy and prototype limits →</Link></div>;
}
