import type { AppState } from '@/state/store';
import type { RecordChange } from './Workspace';
import { dateForDay } from '@/lib/dates';
/** Preserve the entire source privately, activate only independently mapped events/memories. */
export function legacyImportRows(state: AppState, familyId: string, userId: string): RecordChange[] {
    const rows: RecordChange[] = [];
    for (const event of state.schedule) {
        const id = 'legacy-' + crypto.randomUUID();
        rows.push({ id: familyId + ':' + id, kind: 'event', data: { ...event, id, assigneeIds: [userId], backupId: undefined, date: dateForDay(event.day), audience: 'private' }, recipientIds: [userId], editorIds: [userId] });
    }
    for (const memory of state.memories) {
        const id = 'legacy-' + crypto.randomUUID();
        rows.push({ id: familyId + ':' + id, kind: 'memory', data: { ...memory, id, visibility: 'Only me', tagIds: [], audience: 'private' }, recipientIds: [userId], editorIds: [userId] });
    }
    rows.push({ id: familyId + ':legacy-import:' + userId, kind: 'import', data: { completedAt: new Date().toISOString(), legacyState: state }, recipientIds: [userId], editorIds: [userId], expectedVersion: 0 });
    if (rows.length > 60)
        throw new Error('This import exceeds the prototype’s atomic import limit. Keep the original browser data; no records were imported.');
    return rows;
}
