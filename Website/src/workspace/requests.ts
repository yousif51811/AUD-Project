import type { Workspace } from './Workspace';
import type { AppApi } from '@/state/store';
import { canonical } from '@/lib/canonical';
import type { ScheduleEvent, WeeklyPlan } from '@/types';
export async function respondToRequest(w:Workspace,app:AppApi,id:string,yes:boolean):Promise<string> {
        const proposal = w.records.find(r => r.id === id && r.kind === 'proposal' && r.data.status === 'pending');
        if(!proposal)throw new Error('This request is no longer pending.');
        const required = proposal.data.requiredUserIds as string[], accepted = proposal.data.acceptedUserIds as string[];
        if (!required.includes(w.actorId))
            throw new Error('This request needs the named member’s acceptance.');
        if (!yes) {
            await w.save('proposal', id, { ...proposal.data, status: 'declined' }, { expectedVersion: proposal.version });
            return 'Your response was saved.';
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
            return 'Accepted changes saved together.';
        }
        await w.save('proposal', id, { ...proposal.data, acceptedUserIds: next, status: required.every(x => next.includes(x)) ? 'accepted' : 'pending' }, { expectedVersion: proposal.version });
        return 'Your response was saved.';
}
