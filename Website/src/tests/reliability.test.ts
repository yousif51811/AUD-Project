import { describe, expect, it } from 'vitest';
import { completeHousehold, demoState, emptyState, initialState, persistState, applyScheduleChanges, restoreSchedule } from '@/state/store';
import { buildCoachResponse, editCoachPlan } from '@/lib/coach';
import { addActionsToPlan } from '@/lib/plan';
import { optimizeSchedule } from '@/lib/scheduleOptimizer';
import type { KVStore } from '@/lib/storage';

function store(): KVStore {
  const values = new Map<string, string>();
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k,v); }, removeItem: (k) => { values.delete(k); } };
}
describe('household persistence', () => {
  it('does not mutate storage during repeated StrictMode initialization', () => {
    const kv = store();
    expect(initialState(kv).profile?.isDemo).toBe(true);
    expect(initialState(kv).profile?.isDemo).toBe(true);
    expect(kv.getItem('familymind:v1:seeded')).toBeNull();
  });
  it('does not restore a demo assessment or plan after personal setup and reload', () => {
    const kv = store(); const demo = demoState(); persistState(demo, kv);
    const next = completeHousehold(demo, { ...demo.profile!, id: 'personal', name: 'My family', isDemo: false });
    persistState(next, kv);
    const reloaded = initialState(kv);
    expect(reloaded.profile?.name).toBe('My family');
    expect(reloaded.assessment).toBeNull(); expect(reloaded.plan).toBeNull();
    expect(reloaded.schedule).toEqual([]); expect(reloaded.care.reminders).toEqual([]);
  });
  it('keeps cleared data empty after refresh', () => {
    const kv = store(); persistState(demoState(), kv); persistState(emptyState(), kv);
    expect(initialState(kv)).toEqual(emptyState());
  });
});
describe('coach plan editing', () => {
  it('adds the edited title, day and duration shown in the plan preview', () => {
    const state = demoState();
    const r = buildCoachResponse('exam', { profile: state.profile, events: state.schedule, answers: state.assessment!.answers });
    const edited = editCoachPlan(r, [{ ...r.plan[0], title: 'Our edited action', day: 5, minutes: 12 }]);
    const added = addActionsToPlan(null, edited.plan, state.profile, state.schedule).added;
    expect(added[0]).toMatchObject({ title: 'Our edited action', day: 5, minutes: 12 });
    expect(r.plan[0].title).not.toBe('Our edited action');
  });
});
describe('schedule and care undo', () => {
  it('restores the schedule, care backup and log together without undoing unrelated state', () => {
    const state = demoState();
    state.care = { ...state.care, reminders: state.care.reminders.map((r) => ({ ...r, backupId: undefined })) };
    const proposals = optimizeSchedule(state.schedule, state.profile, state.assessment!.answers).filter((p) => p.kind === 'care-backup');
    expect(proposals.length).toBeGreaterThan(0);
    const changed = applyScheduleChanges(state, proposals);
    expect(changed.care).not.toEqual(state.care);
    const restored = restoreSchedule({ ...changed, draft: { note: 'Keep this edit' } }, { schedule: state.schedule, care: state.care });
    expect(restored.schedule).toEqual(state.schedule); expect(restored.care).toEqual(state.care);
    expect(restored.draft.note).toBe('Keep this edit');
  });
});
