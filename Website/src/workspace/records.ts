import { z } from 'zod';
import type { AppState } from '@/state/store';
import type { RecordKind, WorkspaceRecord } from '@/shared/contracts';
const id = z.string().min(1).max(180);
const day = z.number().int().min(0).max(6);
const text = z.string().max(6000);
const action = z.object({ id, title: text, day, minutes: z.number().min(1).max(120), participantIds: z.array(id), done: z.boolean(), category: z.enum(['connection', 'balance', 'study', 'care', 'rest', 'reflection']), reason: text, source: z.enum(['user', 'coach', 'engine']) }).passthrough();
export const payloadSchemas: Partial<Record<RecordKind, z.ZodType>> = {
    profile: z.object({ id, name: text, members: z.array(z.object({ id, name: text, ageGroup: z.enum(['child', 'teen', 'adult', 'older']) }).passthrough()), goals: z.array(text), preferences: z.object({ maxDailyMinutes: z.number().positive() }).passthrough(), consent: z.object({}).passthrough(), isDemo: z.boolean() }).passthrough(),
    event: z.object({ id, title: text, day, start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), assigneeIds: z.array(id), done: z.boolean(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).passthrough(),
    plan: z.object({ actions: z.array(action), parked: z.array(action), reduced: z.boolean(), isSample: z.boolean() }).passthrough(),
    memory: z.object({ id, title: text, message: text, date: text, visibility: text, tagIds: z.array(id), type: text }).passthrough(),
    assessment: z.object({ answers: z.object({}).passthrough(), completed: z.boolean(), source: z.enum(['user', 'demo']) }),
    checkin: z.object({ mood: z.number().min(1).max(5), energy: z.number().min(1).max(5), note: text, createdAt: text }),
    availability: z.object({ available: z.boolean(), talk: z.boolean(), expiresAt: text }),
    care: z.object({ reminders: z.array(z.object({ id, title: text }).passthrough()), emergencyContact: z.unknown() }).passthrough(),
    student: z.object({ goal: text, sleepLog: z.array(z.number()), shares: z.object({}).passthrough() }).passthrough(),
};
export function validatePayload(kind: RecordKind, data: Record<string, unknown>) { const schema = payloadSchemas[kind] ?? z.record(z.string(), z.unknown()); return schema.parse(data) as Record<string, unknown>; }
export function hydrateState(records: WorkspaceRecord[], base: AppState): AppState {
    const state = { ...base, schedule: [] as AppState['schedule'], memories: [] as AppState['memories'] };
    for (const r of records) {
        const data = validatePayload(r.kind, r.data);
        if (['profile', 'assessment', 'plan', 'care', 'student', 'draft'].includes(r.kind))
            Object.assign(state, { [r.kind]: data });
        if (r.kind === 'event')
            state.schedule.push(data as unknown as AppState['schedule'][number]);
        if (r.kind === 'memory')
            state.memories.push(data as unknown as AppState['memories'][number]);
    }
    return state;
}
export function splitState(state: AppState): Array<{
    id: string;
    kind: RecordKind;
    data: Record<string, unknown>;
}> {
    const rows: Array<{
        id: string;
        kind: RecordKind;
        data: Record<string, unknown>;
    }> = [];
    for (const kind of ['profile', 'assessment', 'draft', 'plan', 'care', 'student'] as const) {
        const data = state[kind];
        if (data)
            rows.push({ id: 'slice-' + kind, kind, data: data as unknown as Record<string, unknown> });
    }
    for (const data of state.schedule)
        rows.push({ id: data.id, kind: 'event', data: data as unknown as Record<string, unknown> });
    for (const data of state.memories)
        rows.push({ id: data.id, kind: 'memory', data: data as unknown as Record<string, unknown> });
    return rows;
}
