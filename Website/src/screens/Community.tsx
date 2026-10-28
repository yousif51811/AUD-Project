import { t, useLanguage, languageStore } from '@/i18n';
import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useApp } from '@/state/store';
import { useWorkspace } from '@/workspace/Workspace';
import { canonical } from '@/lib/canonical';
import type { ScheduleEvent, WeeklyPlan } from '@/types';
export default function Community() {
  useLanguage();
    const app = useApp(), w = useWorkspace(), location = useLocation();
    const notifications = location.pathname === '/notifications';
    const [error, setError] = useState(''), [message, setMessage] = useState(''), [share, setShare] = useState(false), [preferences, setPreferences] = useState(() => { try {
        return JSON.parse(localStorage.getItem('familymind:notifications:v1') ?? '{"enabled":true,"quietStart":"22:00","quietEnd":"07:00","connection":false}');
    }
    catch {
        return { enabled: true, quietStart: '22:00', quietEnd: '07:00', connection: false };
    } });
    const run = async (fn: () => Promise<void>) => { setError(''); try {
        await fn();
    }
    catch (e) {
        setError((e as Error).message);
    } };
    const pending = w.records.filter(r => r.kind === 'proposal' && r.data.status === 'pending');
    const quiet = (() => { const time = new Date().toTimeString().slice(0, 5); return preferences.quietStart > preferences.quietEnd ? time >= preferences.quietStart || time < preferences.quietEnd : time >= preferences.quietStart && time < preferences.quietEnd; })();
    const accept = async (id: string, yes: boolean) => {
        const proposal = w.records.find(r => r.id === id)!;
        const required = proposal.data.requiredUserIds as string[], accepted = proposal.data.acceptedUserIds as string[];
        if (!required.includes(w.actorId))
            throw new Error('This request needs the named member’s acceptance.');
        if (!yes) {
            await w.save('proposal', id, { ...proposal.data, status: 'declined' }, { expectedVersion: proposal.version });
            return;
        }
        const next = [...new Set([...accepted, w.actorId])];
        if (required.every(x => next.includes(x))) {
            const versions = proposal.data.baseVersions as Record<string, number>;
            for (const [recordId, version] of Object.entries(versions)) {
                if (w.records.find(r => r.id === recordId)?.version !== version)
                    throw new Error('The shared plan changed. Ask the sender for an updated proposal.');
            }
            const changes: import('@/workspace/Workspace').RecordChange[] = [];
            const family = w.family!;
            const before = proposal.data.beforeSchedule as ScheduleEvent[], after = proposal.data.afterSchedule as ScheduleEvent[];
            const plan = proposal.data.afterPlan as WeeklyPlan | null;
            if (plan && canonical(plan) !== canonical(proposal.data.beforePlan))
                changes.push({ kind: 'plan', id: family.id + ':slice-plan', data: { ...plan, audience: 'family' }, expectedVersion: versions[family.id + ':slice-plan'] ?? 0, recipientIds: w.mode === 'demo' ? app.profile!.members.map(m => m.id) : w.members.filter(m => m.status === 'ACTIVE').map(m => m.userId), editorIds: w.members.filter(m => m.status === 'ACTIVE').map(m => m.userId) });
            for (const event of after.filter(e => canonical(e) !== canonical(before.find(x => x.id === e.id) ?? null)))
                changes.push({ kind: 'event', id: family.id + ':' + event.id, data: { ...event, audience: 'family' }, expectedVersion: versions[family.id + ':' + event.id] ?? 0, recipientIds: w.mode === 'demo' ? app.profile!.members.map(m => m.id) : w.members.filter(m => m.status === 'ACTIVE').map(m => m.userId), editorIds: w.members.filter(m => m.status === 'ACTIVE').map(m => m.userId) });
            for (const event of before.filter(e => !after.some(x => x.id === e.id)))
                changes.push({ kind: 'event', id: family.id + ':' + event.id, data: event as unknown as Record<string, unknown>, expectedVersion: versions[family.id + ':' + event.id], deleted: true });
            changes.push({ kind: 'proposal', id, data: { ...proposal.data, acceptedUserIds: next, status: 'accepted' }, expectedVersion: proposal.version });
            await w.saveMany(changes);
            setMessage('Accepted changes saved together.');
            return;
        }
        await w.save('proposal', id, { ...proposal.data, acceptedUserIds: next, status: required.every(x => next.includes(x)) ? 'accepted' : 'pending' }, { expectedVersion: proposal.version });
        setMessage('Your response was saved.');
    };
    return <div className="stack stack-lg"><header className="planner-heading"><div><p className="planner-date">{t("A little attention goes a long way")}</p><h1>{notifications ? t("Your reminders & requests.") : t("A moment for yourself.")}</h1><p>{notifications ? t("See what needs your attention, without constant interruptions.") : t("Choose what to record and what, if anything, you want to share.")}</p></div></header>{error && <p className="notice notice-safety" role="alert">{t(error)}</p>}{message && <p role="status" className="notice notice-info">{t(message)}</p>}
 {notifications ? <><section className="daily-paper stack"><h2>{t("Reminders")}</h2><p className="hint">{t("Calculated while the website is open. No closed-browser push, email delivery or emergency monitoring.")}</p><label><input type="checkbox" checked={preferences.enabled} onChange={e => { const v = { ...preferences, enabled: e.target.checked }; setPreferences(v); localStorage.setItem('familymind:notifications:v1', JSON.stringify(v)); }}/>{t(" Enable in-app reminders")}</label><div className="grid grid-2">{(['quietStart', 'quietEnd'] as const).map(key => <label className="field" key={key}>{key === 'quietStart' ? t("Quiet hours start") : t("Quiet hours end")}<input className="input" type="time" value={preferences[key]} onChange={e => { const v = { ...preferences, [key]: e.target.value }; setPreferences(v); localStorage.setItem('familymind:notifications:v1', JSON.stringify(v)); }}/></label>)}</div><label><input type="checkbox" checked={preferences.connection} onChange={e => { const v = { ...preferences, connection: e.target.checked }; setPreferences(v); localStorage.setItem('familymind:notifications:v1', JSON.stringify(v)); }}/>{t(" Include a gentle daily reminder to connect with family")}</label>
 {!preferences.enabled ? <p>{t("Reminders are paused.")}</p> : quiet ? <p>{t("Quiet hours are active. Requests remain available below.")}</p> : <><ul>{(app.plan?.actions ?? []).filter(a => !a.done && a.day === app.today && a.participantIds.includes(w.actorId)).map(a => <li key={a.id}>{a.title} · {a.minutes}{t(" minutes")}</li>)}</ul>{preferences.connection && <p>{t("When it suits you, ask someone in your family how their day is going.")}</p>}<p className="hint">{t("Only commitments recorded in this workspace appear here.")}</p></>}</section>
 <section className="daily-paper stack"><h2>{t("Changes waiting for agreement")}</h2>{!pending.length && <p>{t("No pending requests.")}</p>}{pending.map(r => <article className="card stack" key={r.id}><h3>{String(r.data.title)}</h3><details><summary>{t("Review the proposed changes")}</summary><pre className="context-preview">{JSON.stringify({ weeklyPlan: r.data.afterPlan, calendar: r.data.afterSchedule }, null, 2)}</pre></details><p>{(r.data.acceptedUserIds as string[]).length}{t(" of ")}{(r.data.requiredUserIds as string[]).length}{t(" required members accepted.")}</p>{(r.data.requiredUserIds as string[]).includes(w.actorId) && !(r.data.acceptedUserIds as string[]).includes(w.actorId) && <div className="cluster"><button className="btn btn-primary" onClick={() => void run(() => accept(r.id, true))}>{t("Accept")}</button><button className="btn btn-secondary" onClick={() => void run(() => accept(r.id, false))}>{t("Decline")}</button></div>}</article>)}</section></> :
            <><section className="daily-paper stack"><h2>{t("Your check-in")}</h2><form className="stack" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { await w.save('checkin', crypto.randomUUID(), { mood: Number(f.get('mood')), energy: Number(f.get('energy')), note: String(f.get('note')), createdAt: new Date().toISOString(), audience: share ? 'family' : 'private' }, { recipientIds: share ? (w.mode === 'demo' ? app.profile!.members.map(m => m.id) : w.members.filter(m => m.status === 'ACTIVE').map(m => m.userId)) : [w.actorId], editorIds: [w.actorId] }); setMessage('Check-in saved with your chosen audience.'); }); }}><div className="grid grid-2">{['mood', 'energy'].map(key => <label className="field" key={key}>{key === 'mood' ? t("How does today feel?") : t("How much energy do you have?")}<select className="select" name={key}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>)}</div><label className="field">{t("A note for yourself")}<textarea className="textarea" name="note" rows={3} maxLength={2000}/></label><label><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)}/>{t(" Share this check-in, including the note, with my family")}</label><p className="hint">{t("Unchecked means only you. These are personal reflections, not clinical measurements.")}</p><button className="btn btn-primary">{t("Save check-in")}</button></form></section>
 <section className="daily-paper stack"><h2>{t("Choose your availability")}</h2><p>{t("This status expires after one hour. It is never inferred from mood, calendar gaps or activity.")}</p><div className="cluster">{[{ label: 'Available to help', available: true, talk: false }, { label: 'Open to talk', available: false, talk: true }, { label: 'Clear status', available: false, talk: false }].map(v => <button key={v.label} className="btn btn-secondary" onClick={() => void run(async () => { await w.save('availability', (w.family?.id ?? 'sample') + ':availability:' + w.actorId, { available: v.available, talk: v.talk, expiresAt: new Date(Date.now() + 3600000).toISOString(), audience: 'family' }, { recipientIds: w.mode === 'demo' ? app.profile!.members.map(m => m.id) : w.members.filter(m => m.status === 'ACTIVE').map(m => m.userId), editorIds: [w.actorId] }); setMessage('Availability updated.'); })}>{t(v.label)}</button>)}</div></section>
 <section className="daily-paper stack"><h2>{t("Check-ins you can read")}</h2>{w.records.filter(r => r.kind === 'checkin').map(r => <article className="card" key={r.id}><p>{r.authorId === w.actorId ? t("You") : t("A family member")}{t(" · mood ")}{String(r.data.mood)}{t("/5 · energy ")}{String(r.data.energy)}/5</p><p>{String(r.data.note)}</p><span className="hint">{new Date(String(r.data.createdAt)).toLocaleString(languageStore.getSnapshot() === 'ar' ? 'ar-AE' : 'en-GB')}</span></article>)}<Link className="family-text-link" to="/assessment">{t("Take the household assessment →")}</Link></section></>}
 </div>;
}
