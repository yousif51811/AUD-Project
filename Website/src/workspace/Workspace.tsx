'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { createIdentity, protectIdentity, unlockIdentity, encryptRecord, decryptRecord, type Identity } from '@/lib/vault/crypto';
import { rememberIdentity } from '@/lib/vault/device';
import { prepareAccess, forgetPreparedAccess } from './access';
import { canonical } from '@/lib/canonical';
import { api } from './transport';
import { envelopeSchema, type FamilySummary, type Member, type SessionUser, type RecordKind, type WorkspaceRecord, type VaultBackup } from '@/shared/contracts';
import { validatePayload } from './records';
import { demoProfile } from '@/data/demo';
export interface RecordChange {
    kind: RecordKind;
    id: string;
    data: Record<string, unknown>;
    recipientIds?: string[];
    editorIds?: string[];
    cloudAllowed?: boolean;
    expectedVersion?: number;
    deleted?: boolean;
}
export interface Workspace {
    user: SessionUser | null;
    recoveryCode: string;
    completeSignIn: (password?: string) => Promise<void>;
    identity: Identity | null;
    family: FamilySummary | null;
    families: FamilySummary[];
    members: Member[];
    records: WorkspaceRecord[];
    mode: 'demo' | 'account';
    actorId: string;
    status: string;
    error: string;
    loading: boolean;
    generation: number;
    setError: (s: string) => void;
    refresh: () => Promise<void>;
    unlock: (secret: string, recovery?: boolean) => Promise<void>;
    createVault: (pass: string) => Promise<string>;
    selectFamily: (id: string) => void;
    enterDemo: (id?: string) => void;
    exitDemo: () => void;
    signOut: () => Promise<void>;
    save: (kind: RecordKind, id: string, data: Record<string, unknown>, options?: {
        recipientIds?: string[];
        editorIds?: string[];
        cloudAllowed?: boolean;
        expectedVersion?: number;
    }) => Promise<void>;
    saveMany: (changes: RecordChange[]) => Promise<void>;
    remove: (id: string) => Promise<void>;
    approve: (id: string) => Promise<void>;
    pinMember: (m: Member) => void;
}
const Context = createContext<Workspace | null>(null);
const pinsKey = 'familymind:public-keys:v1';
function checkPin(m: Member) {
    if (!m.publicKey || !m.signingKey)
        return;
    const pins = JSON.parse(localStorage.getItem(pinsKey) ?? '{}');
    const key = m.publicKey + ':' + m.signingKey;
    if (pins[m.userId] && pins[m.userId] !== key)
        throw new Error('An established encryption key changed. Stop and verify the member before continuing.');
    pins[m.userId] = key;
    localStorage.setItem(pinsKey, JSON.stringify(pins));
}
export function WorkspaceProvider({ children }: {
    children: ReactNode;
}) {
    const [user, setUser] = useState<SessionUser | null>(null), [identity, setIdentity] = useState<Identity | null>(null);
    const [recoveryCode, setRecoveryCode] = useState('');
    const [families, setFamilies] = useState<FamilySummary[]>([]), [family, setFamily] = useState<FamilySummary | null>(null);
    const [members, setMembers] = useState<Member[]>([]), [records, setRecords] = useState<WorkspaceRecord[]>([]);
    const [mode, setMode] = useState<'demo' | 'account'>('demo'), [demoMember, setDemoMember] = useState(() => { try {
        const id = sessionStorage.getItem('familymind:demo-actor:v1');
        return demoProfile().members.some(m => m.id === id) ? id! : demoProfile().members[0].id;
    }
    catch {
        return demoProfile().members[0].id;
    } });
    const [demoRecords, setDemoRecords] = useState<WorkspaceRecord[]>(() => { try {
        return JSON.parse(sessionStorage.getItem('familymind:demo-records:v1') ?? '[]');
    }
    catch {
        return [];
    } });
    useEffect(() => { try {
        sessionStorage.setItem('familymind:demo-records:v1', JSON.stringify(demoRecords));
    }
    catch { /* ephemeral sample */ } }, [demoRecords]);
    useEffect(() => { const reset = () => setDemoRecords([]); window.addEventListener('familymind:reset-demo', reset); return () => window.removeEventListener('familymind:reset-demo', reset); }, []);
    const demoActor = useRef(demoMember);
    demoActor.current = demoMember;
    const [status, setStatus] = useState('Sample family'), [error, setError] = useState(''), [loading, setLoading] = useState(false), [generation, setGeneration] = useState(0);
    const envs = useRef(new Map<string, ReturnType<typeof envelopeSchema.parse>>());
    const epoch = useRef(0), loginEpoch = useRef(0);
    const running = useRef(false);
    const serial = useRef(Promise.resolve());
    const current = useRef({ user, identity, family, members, mode });
    current.current = { user, identity, family, members, mode };
    const clear = useCallback(() => { epoch.current++; envs.current.clear(); setRecords([]); setMembers([]); setGeneration(x => x + 1); window.dispatchEvent(new Event('familymind:clear-ai')); }, []);
    const refresh = useCallback(async () => {
        const { user: u, identity: key, family: f, mode: m } = current.current;
        if (!u || m !== 'account' || running.current)
            return;
        const run = epoch.current;
        try {
            const fs = await api<FamilySummary[]>('families');
            if (run !== epoch.current)
                return;
            setFamilies(fs);
            if (!f && fs.some(x => x.status === 'ACTIVE')) { setFamily(fs.find(x => x.status === 'ACTIVE')!); return; }
            if (!f || !fs.some(x => x.id === f.id && x.status === 'ACTIVE')) {
                if (f) {
                    setFamily(null);
                    clear();
                }
                return;
            }
            const activeSummary = fs.find(x => x.id === f.id);
            if (activeSummary && canonical(activeSummary) !== canonical(f))
                setFamily(activeSummary);
            if (!key)
                return;
            const people = await api<Member[]>(`families/${f.id}/members`);
            if (run !== epoch.current)
                return;
            for (const p of people)
                checkPin(p);
            setMembers(people);
            const rows = await api<Array<{
                envelope: unknown;
                updatedAt: string;
            }>>(`records?familyId=${encodeURIComponent(f.id)}`);
            if (run !== epoch.current)
                return;
            const next: WorkspaceRecord[] = [];
            const nextEnvs = new Map<string, ReturnType<typeof envelopeSchema.parse>>();
            for (const row of rows) {
                const e = envelopeSchema.parse(row.envelope);
                if (e.familyId !== f.id)
                    throw new Error('Unexpected family record.');
                const sender = people.find(x => x.userId === e.senderId);
                if (!sender)
                    throw new Error('Record sender could not be verified.');
                const payload = await decryptRecord(e, u.id, key, sender);
                validatePayload(e.kind, payload.data);
                nextEnvs.set(e.id, e);
                if (!e.deleted)
                    next.push({ id: e.id, kind: e.kind, authorId: e.authorId, recipientIds: e.recipientIds, editorIds: e.editorIds, version: e.version, data: payload.data, cloudAllowed: payload.cloudAllowed });
            }
            if (run !== epoch.current)
                return;
            envs.current = nextEnvs;
            setRecords(old => canonical(old) === canonical(next) ? old : next);
            setStatus('Encrypted changes up to date');
        }
        catch (e) {
            if (run === epoch.current) {
                setError((e as Error).message);
                setStatus('Synchronization paused');
            }
        }
    }, [clear]);
    const completeSignIn = useCallback(async (password?: string) => {
        const attempt = ++loginEpoch.current;
        const response = await authClient.getSession();
        if (!response.data || attempt !== loginEpoch.current) return;
        const account = response.data.user as SessionUser;
        setUser(account); setMode('account'); setLoading(true);
        try {
            const access = await prepareAccess(account.id, password);
            if (attempt !== loginEpoch.current) return;
            setIdentity(access.identity); if (access.recoveryCode) setRecoveryCode(access.recoveryCode);
            setStatus(access.identity ? 'Encrypted changes up to date' : 'Restore access to continue');
            if (access.identity && !access.remembered) setError('Browser storage is unavailable. Save your recovery code before leaving this page.');
        } catch (e) { if (attempt === loginEpoch.current) setError((e as Error).message); throw e; }
        finally { if (attempt === loginEpoch.current) setLoading(false); }
    }, []);
    useEffect(() => { void completeSignIn().catch(e => setError((e as Error).message)); }, [completeSignIn]);
    const waitingForProfile = !!family && !records.some(record => record.kind === 'profile');
    useEffect(() => { if (mode !== 'account' || !user)
        return; void refresh(); const tick = () => { if (document.visibilityState === 'visible' && !running.current)
        void refresh(); }; const id = window.setInterval(tick, waitingForProfile ? 1000 : 15000); window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick); return () => { clearInterval(id); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); }; }, [refresh, mode, user, family, identity, waitingForProfile]);
    const save: Workspace['save'] = useCallback((kind, id, data, options = {}) => {
        const captured = epoch.current;
        const task = async () => {
            if (captured !== epoch.current)
                throw new Error('The active family changed.');
            const { user: u, identity: key, family: f, members: people, mode: m } = current.current;
            if (m === 'demo') {
                const actor = demoActor.current;
                setDemoRecords(rows => { const old = rows.find(r => r.id === id); return [...rows.filter(r => r.id !== id), { id, kind, data, authorId: old?.authorId ?? actor, version: (old?.version ?? 0) + 1, recipientIds: options.recipientIds ?? old?.recipientIds ?? [actor], editorIds: options.editorIds ?? old?.editorIds ?? [actor], cloudAllowed: options.cloudAllowed ?? false }]; });
                return;
            }
            if (!u || !key || !f)
                throw new Error('Sign in, unlock your vault and choose a family.');
            validatePayload(kind, data);
            const old = envs.current.get(id);
            if (options.expectedVersion !== undefined && (old?.version ?? 0) !== options.expectedVersion)
                throw new Error('This item changed. Reload before confirming it.');
            if (old && !old.editorIds.includes(u.id) && !(old.kind === 'profile' && f.role === 'OWNER'))
                throw new Error('You cannot edit this record.');
            const active = people.filter(x => x.status === 'ACTIVE' && x.publicKey);
            const requested = options.recipientIds ?? old?.recipientIds ?? [u.id];
            const recipientIds = [...new Set([...requested, u.id, old?.authorId ?? u.id])].filter(x => active.some(p => p.userId === x));
            const recipientKeys = active.filter(x => recipientIds.includes(x.userId));
            const editors = (options.editorIds ?? old?.editorIds ?? [u.id]).filter(x => recipientIds.includes(x));
            const e = await encryptRecord({ id, familyId: f.id, kind, version: (old?.version ?? 0) + 1, authorId: old?.authorId ?? u.id, senderId: u.id, editorIds: editors, recipients: recipientKeys, payload: { data, cloudAllowed: options.cloudAllowed ?? false } }, key);
            setStatus('Saving encrypted changes…');
            running.current = true;
            try {
                await api('records', e);
                if (captured !== epoch.current)
                    return;
                envs.current.set(id, e);
                setRecords(rows => [...rows.filter(x => x.id !== id), { id, kind, version: e.version, authorId: e.authorId, recipientIds, editorIds: editors, data, cloudAllowed: options.cloudAllowed ?? false }]);
                setStatus('Encrypted changes saved');
            }
            finally {
                running.current = false;
            }
        };
        const operation = serial.current.then(task);
        serial.current = operation.catch(e => { setError((e as Error).message); });
        return operation;
    }, []);
    const saveMany: Workspace['saveMany'] = (changes) => {
        const captured = epoch.current;
        const task = async () => {
            const { user: u, identity: key, family: f, members: people, mode: m } = current.current;
            if (m === 'demo') {
                setDemoRecords(rows => { let next = [...rows]; for (const c of changes) {
                    const old = next.find(r => r.id === c.id);
                    next = next.filter(r => r.id !== c.id);
                    if (!c.deleted)
                        next.push({ id: c.id, kind: c.kind, data: c.data, authorId: old?.authorId ?? demoActor.current, version: (old?.version ?? 0) + 1, recipientIds: c.recipientIds ?? old?.recipientIds ?? [demoActor.current], editorIds: c.editorIds ?? old?.editorIds ?? [demoActor.current], cloudAllowed: c.cloudAllowed ?? false });
                } return next; });
                return;
            }
            if (!u || !key || !f || captured !== epoch.current)
                throw new Error('Unlock the active family first.');
            const active = people.filter(p => p.status === 'ACTIVE' && p.publicKey);
            const envelopes: import('@/shared/contracts').EncryptedEnvelope[] = [];
            for (const change of changes) {
                validatePayload(change.kind, change.data);
                const old = envs.current.get(change.id);
                if (change.expectedVersion !== undefined && (old?.version ?? 0) !== change.expectedVersion)
                    throw new Error('A proposed item changed. Reload before confirming.');
                const recipientIds = [...new Set([...(change.recipientIds ?? old?.recipientIds ?? []), u.id])].filter(id => active.some(p => p.userId === id));
                const editors = (change.editorIds ?? old?.editorIds ?? [u.id]).filter(id => recipientIds.includes(id));
                envelopes.push(await encryptRecord({ id: change.id, familyId: f.id, kind: change.kind, version: (old?.version ?? 0) + 1, authorId: old?.authorId ?? u.id, senderId: u.id, editorIds: editors, recipients: active.filter(p => recipientIds.includes(p.userId)), payload: { data: change.data, cloudAllowed: change.cloudAllowed ?? false }, deleted: change.deleted }, key));
            }
            if (!envelopes.length)
                return;
            running.current = true;
            setStatus('Saving encrypted changes…');
            try {
                await api('records/batch', { records: envelopes });
                if (captured !== epoch.current)
                    return;
                for (const e of envelopes)
                    envs.current.set(e.id, e);
                setRecords(rows => [...rows.filter(r => !envelopes.some(e => e.id === r.id)), ...envelopes.filter(e => !e.deleted).map(e => { const c = changes.find(c => c.id === e.id)!; return { id: e.id, kind: e.kind, version: e.version, authorId: e.authorId, recipientIds: e.recipientIds, editorIds: e.editorIds, data: c.data, cloudAllowed: c.cloudAllowed ?? false }; })]);
                setStatus('Encrypted changes saved');
            }
            finally {
                running.current = false;
            }
        };
        const operation = serial.current.then(task);
        serial.current = operation.catch(e => setError((e as Error).message));
        return operation;
    };
    const remove: Workspace['remove'] = async (id) => {
        if (current.current.mode === 'demo') {
            setDemoRecords(rows => rows.filter(r => r.id !== id));
            return;
        }
        const { user: u, identity: key } = current.current;
        const old = envs.current.get(id);
        if (!old || !u || !key)
            return;
        if (!old.editorIds.includes(u.id))
            throw new Error('You cannot remove this record.');
        const sender = members.find(x => x.userId === old.senderId)!;
        const payload = await decryptRecord(old, u.id, key, sender);
        const e = await encryptRecord({ ...old, editorIds: old.editorIds.filter(id => members.some(m => m.userId === id && m.status === 'ACTIVE')), version: old.version + 1, senderId: u.id, recipients: members.filter(x => old.recipientIds.includes(x.userId) && x.status === 'ACTIVE'), payload, deleted: true }, key);
        await api('records', e);
        envs.current.set(id, e);
        setRecords(rows => rows.filter(x => x.id !== id));
    };
    const unlock = async (secret: string, recovery = false) => {
        if (!user)
            throw new Error('Sign in first.');
        setLoading(true);
        try {
            const saved = await api<{
                publicKey: string;
                signingKey: string;
                vault: VaultBackup;
            } | null>('identity');
            if (!saved)
                throw new Error('Create your vault first.');
            const key = await unlockIdentity(saved.vault, secret, recovery);
            if (key.publicKey !== saved.publicKey || key.signingKey !== saved.signingKey)
                throw new Error('Vault identity mismatch.');
            clear();
            setIdentity(key);
            await rememberIdentity(user.id, key);
            setMode('account');
            setError('');
        }
        finally {
            setLoading(false);
        }
    };
    const createVault = async (pass: string) => { if (!user)
        throw new Error('Sign in first.'); setLoading(true); try {
        const key = await createIdentity();
        const { vault, recoveryCode } = await protectIdentity(key, pass);
        await api('identity', { publicKey: key.publicKey, signingKey: key.signingKey, vault });
        clear();
        setIdentity(key);
        setMode('account');
        return recoveryCode;
    }
    finally {
        setLoading(false);
    } };
    const approve = async (id: string) => {
        if (!family || !user)
            throw new Error('Choose your family first.');
        await api(`families/${family.id}/members`, { userId: id, operation: 'approve' });
        const approved = members.find(x => x.userId === id);
        if (!approved)
            throw new Error('Refresh the member list first.');
        // Never share private or selected-recipient records merely because membership was approved.
        setMembers(xs => xs.map(x => x.userId === id ? { ...x, status: 'ACTIVE' } : x));
        current.current.members = members.map(x => x.userId === id ? { ...x, status: 'ACTIVE' } : x);
        for (const record of records.filter(r => r.data.audience === 'family' && (r.authorId === user.id || r.kind === 'profile')))
            await save(record.kind, record.id, record.data, { recipientIds: [...record.recipientIds, id], editorIds: approved.role !== 'VIEWER' && ['plan', 'event', 'care'].includes(record.kind) ? [...record.editorIds, id] : record.editorIds, cloudAllowed: record.cloudAllowed });
        const profile = records.find(r => r.kind === 'profile');
        if (profile) {
            const currentMembers = (profile.data.members as Array<Record<string, unknown>>) ?? [];
            if (!currentMembers.some(m => m.id === id))
                await save('profile', profile.id, { ...profile.data, members: [...currentMembers, { id, name: approved.displayName ?? 'Family member', ageGroup: approved.ageGroup, role: 'Family member', color: 'teal', icon: 'leaf', accessibility: [], sharesSummaries: false }] }, { recipientIds: [...profile.recipientIds, id], editorIds: profile.editorIds });
        }
        await refresh();
    };
    const enterDemo = (id?: string) => { clear(); setMode('demo'); setFamily(null); setIdentity(null); if (id) {
        setDemoMember(id);
        try {
            sessionStorage.setItem('familymind:demo-actor:v1', id);
        }
        catch { /* in-memory choice */ }
    } setStatus('Sample family · fictional data'); setError(''); };
    return <Context.Provider value={{ user, recoveryCode, completeSignIn, identity, family, families, members, records: mode === 'demo' ? demoRecords.filter(r => r.recipientIds.includes(demoMember)) : records, mode, actorId: mode === 'demo' ? demoMember : user?.id ?? '', status, error, loading, generation, setError, refresh, unlock, createVault, selectFamily: id => { clear(); setFamily(families.find(x => x.id === id) ?? null); }, enterDemo, exitDemo: () => { clear(); setMode('account'); if (user && !identity) void completeSignIn().catch(e => setError((e as Error).message)); }, signOut: async () => { loginEpoch.current++; setLoading(false); if (user) await forgetPreparedAccess(user.id); setRecoveryCode(''); clear(); setIdentity(null); setFamily(null); setFamilies([]); setUser(null); setMode('demo'); await authClient.signOut(); }, save, saveMany, remove, approve, pinMember: checkPin }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value)
    throw new Error('Workspace provider is missing.'); return value; }
