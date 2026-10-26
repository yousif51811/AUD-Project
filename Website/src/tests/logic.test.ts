import { describe, expect, it } from 'vitest';
import { DEMO_ANSWERS, demoProfile, demoSchedule, demoCare } from '@/data/demo';
import { computeScore, statusFor, statusKeyFor, categoryScores, deductionsFor, isComplete } from '@/lib/scoring';
import { analyze, generateRecommendations } from '@/lib/recommendations';
import { generatePlan, setReduced, addActionsToPlan, regenerateAction, MAX_ACTIONS_PER_DAY } from '@/lib/plan';
import { optimizeSchedule, applyProposals, detectConflicts, overloadedMembers } from '@/lib/scheduleOptimizer';
import { checkSafety } from '@/lib/safety';
import { classifyScenario, buildCoachResponse } from '@/lib/coach';
import { getCoachResponse, validateCoachResponse } from '@/lib/ai';
import { serialize, deserialize, load, save, memoryStore, isObject, KEYS } from '@/lib/storage';
import { sanitizeText } from '@/lib/sanitize';
import { balanceOf } from '@/lib/people';
import { toMin, fromMin, overlaps } from '@/lib/time';
import type { AssessmentAnswers } from '@/types';

const best: AssessmentAnswers = {
  familyTime: 'fourPlus', stress: 'low', communication: 'strong', tasks: 'fair', student: 'none',
  elder: 'none', routines: 'none', sleep: 'good', goals: [], note: '',
};
const worst: AssessmentAnswers = {
  familyTime: 'none', stress: 'overwhelming', communication: 'veryDifficult', tasks: 'concentrated', student: 'severe',
  elder: 'yes', routines: 'repeated', sleep: 'poor', goals: [], note: '',
};

describe('scoring', () => {
  it('gives 100 for the best answers and clamps the worst at 0', () => {
    expect(computeScore(best)).toBe(100);
    // 28+22+18+20+18+15+12 = 133 deductions -> clamped
    expect(computeScore(worst)).toBe(0);
  });
  it('applies each documented deduction', () => {
    expect(computeScore({ ...best, stress: 'moderate' })).toBe(92);
    expect(computeScore({ ...best, stress: 'high' })).toBe(82);
    expect(computeScore({ ...best, communication: 'limited' })).toBe(86);
    expect(computeScore({ ...best, familyTime: 'once' })).toBe(89);
    expect(computeScore({ ...best, tasks: 'uneven' })).toBe(87);
    expect(computeScore({ ...best, student: 'high' })).toBe(88);
    expect(computeScore({ ...best, elder: 'yes', routines: 'occasional' })).toBe(93);
    expect(computeScore({ ...best, elder: 'yes', routines: 'repeated' })).toBe(85);
    expect(computeScore({ ...best, sleep: 'poor' })).toBe(88);
  });
  it('does not penalize missed routines when no older-adult support is needed', () => {
    expect(computeScore({ ...best, elder: 'none', routines: 'repeated' })).toBe(100);
  });
  it('classifies boundaries correctly', () => {
    expect(statusFor(100)).toBe('Strong Foundation');
    expect(statusFor(80)).toBe('Strong Foundation');
    expect(statusFor(79)).toBe('Stable with Opportunities');
    expect(statusFor(60)).toBe('Stable with Opportunities');
    expect(statusFor(59)).toBe('Needs Attention');
    expect(statusFor(40)).toBe('Needs Attention');
    expect(statusFor(39)).toBe('Priority Support');
    expect(statusKeyFor(0)).toBe('priority');
  });
  it('produces integer category scores and one per category', () => {
    const cats = categoryScores(DEMO_ANSWERS);
    expect(cats.map((c) => c.id)).toEqual(['connection', 'balance', 'student', 'care', 'rest']);
    for (const c of cats) expect(Number.isInteger(c.score)).toBe(true);
    expect(categoryScores(best).every((c) => c.score === 100)).toBe(true);
  });
  it('deductions sum to 100 - score when not clamped', () => {
    const total = deductionsFor(DEMO_ANSWERS).reduce((s, d) => s + d.points, 0);
    expect(100 - total).toBe(computeScore(DEMO_ANSWERS));
  });
  it('detects complete answers', () => {
    expect(isComplete({ stress: 'low' })).toBe(false);
    expect(isComplete(best)).toBe(true);
  });
});

describe('Al Noor demo determinism', () => {
  it('produces a Needs Attention result of 45, every time', () => {
    const p = demoProfile();
    const a = analyze(DEMO_ANSWERS, p, demoSchedule());
    const b = analyze(DEMO_ANSWERS, demoProfile(), demoSchedule());
    expect(a.score).toBe(45);
    expect(a.status).toBe('Needs Attention');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('ranks the exam/sleep, check-in and care recommendations first', () => {
    const recs = generateRecommendations(DEMO_ANSWERS, demoProfile(), demoSchedule());
    expect(recs.slice(0, 3).map((r) => r.kind)).toEqual(['study', 'checkin', 'care']);
    expect(recs.length).toBe(6);
    for (const r of recs) {
      expect(r.signals.length).toBeGreaterThan(0);
      expect(r.why.length).toBeGreaterThan(10);
      expect(r.control.length).toBeGreaterThan(5);
      expect(r.minutes).toBeGreaterThan(0);
    }
  });
  it('names Zayed and Omar in the study recommendation', () => {
    const r = generateRecommendations(DEMO_ANSWERS, demoProfile(), demoSchedule())[0];
    expect(r.action).toContain('Zayed');
    expect(r.action).toContain('Omar');
  });
  it('recommendations react to answers', () => {
    const calm = generateRecommendations(best, demoProfile(), demoSchedule()).map((r) => r.kind);
    expect(calm).toEqual(['reflect']);
    const rest = generateRecommendations({ ...best, sleep: 'poor' }, demoProfile(), []).map((r) => r.kind);
    expect(rest).toContain('rest');
  });
});

describe('weekly plan', () => {
  it('matches the demo plan', () => {
    const plan = generatePlan(DEMO_ANSWERS, demoProfile(), demoSchedule(), { isSample: true });
    const day = (d: number) => plan.actions.filter((a) => a.day === d).map((a) => a.title);
    expect(day(0)[0]).toMatch(/10-minute family check-in/);
    expect(day(1)[0]).toMatch(/grocery planning/);
    expect(day(2).length).toBe(2);
    expect(day(2)[0]).toMatch(/study block/i);
    expect(day(3)[0]).toMatch(/family call/);
    expect(day(4)[0]).toMatch(/family walk/);
    expect(day(5)[0]).toMatch(/Responsibility-balance/);
    expect(day(6)[0]).toMatch(/Gratitude/);
  });
  it('never exceeds two actions per day, and has an action every day', () => {
    for (const a of [DEMO_ANSWERS, best, worst]) {
      const plan = generatePlan(a, demoProfile(), demoSchedule());
      for (let d = 0; d < 7; d++) {
        const n = plan.actions.filter((x) => x.day === d).length;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(MAX_ACTIONS_PER_DAY);
      }
      for (const x of plan.actions) expect(x.reason.length).toBeGreaterThan(5);
    }
  });
  it('reduce workload parks and restores actions', () => {
    const plan = generatePlan(DEMO_ANSWERS, demoProfile(), demoSchedule());
    const reduced = setReduced(plan, true);
    expect(reduced.actions.length).toBe(7);
    expect(reduced.parked.length).toBe(plan.actions.length - 7);
    const back = setReduced(reduced, false);
    expect(back.actions.length).toBe(plan.actions.length);
  });
  it('regenerates one action deterministically', () => {
    const plan = generatePlan(DEMO_ANSWERS, demoProfile(), demoSchedule());
    const target = plan.actions.find((a) => a.day === 4)!;
    const next = regenerateAction(plan, target.id);
    expect(next.actions.find((a) => a.id === target.id)!.title).not.toBe(target.title);
    expect(regenerateAction(plan, target.id)).toEqual(next);
  });
  it('adds coach actions without breaking the daily cap or duplicating', () => {
    const p = demoProfile();
    const ev = demoSchedule();
    const plan = generatePlan(DEMO_ANSWERS, p, ev);
    const resp = buildCoachResponse('exam', { profile: p, events: ev, answers: DEMO_ANSWERS });
    const r1 = addActionsToPlan(plan, resp.plan, p, ev);
    expect(r1.added.length).toBeGreaterThan(0);
    for (let d = 0; d < 7; d++) expect(r1.plan.actions.filter((x) => x.day === d).length).toBeLessThanOrEqual(2);
    const r2 = addActionsToPlan(r1.plan, resp.plan, p, ev);
    expect(r2.added.length).toBe(0);
  });
});

describe('schedule optimizer', () => {
  const p = demoProfile();
  const events = demoSchedule();
  it('detects the Wednesday study/club conflict and overload', () => {
    const c = detectConflicts(events);
    expect(c.length).toBe(1);
    expect(c[0].memberIds).toEqual(['zayed']);
    expect(overloadedMembers(events, 2)).toEqual(['zayed']);
  });
  const props = optimizeSchedule(events, p, DEMO_ANSWERS, 1);
  it('proposes the documented changes in a stable order', () => {
    expect(props.map((x) => x.kind)).toEqual(['reassign', 'share', 'protect-study', 'protect-study', 'recovery', 'care-backup', 'connect', 'family-time']);
    expect(JSON.stringify(optimizeSchedule(events, p, DEMO_ANSWERS, 1))).toBe(JSON.stringify(props));
    for (const x of props) { expect(x.why.length).toBeGreaterThan(20); expect(x.changes.length).toBeGreaterThan(0); }
  });
  it('does not mutate the original schedule', () => {
    const snapshot = JSON.stringify(events);
    applyProposals(events, props);
    expect(JSON.stringify(events)).toBe(snapshot);
  });
  it('moves the Wednesday kitchen task from Zayed to Omar', () => {
    const after = applyProposals(events, props);
    const k = after.find((e) => e.title.startsWith('Kitchen'))!;
    expect(k.assigneeIds).toEqual(['omar']);
  });
  it('resolves conflicts, overload and improves balance', () => {
    const after = applyProposals(events, props);
    expect(detectConflicts(after).length).toBe(0);
    expect(overloadedMembers(after, 2)).toEqual([]);
    const top = (evs: typeof events) => Math.max(...balanceOf(evs, p.members).map((b) => b.percent));
    expect(top(after)).toBeLessThan(top(events));
  });
  it('assigns a backup to every medication reminder and adds family time', () => {
    const after = applyProposals(events, props);
    expect(after.filter((e) => e.careReminder).every((e) => e.backupId === 'omar')).toBe(true);
    expect(after.filter((e) => e.category === 'Family Time' && e.id.startsWith('opt-')).length).toBe(2);
    expect(after.filter((e) => e.protected && e.category === 'Study').length).toBe(2);
  });
  it('applying a subset only applies the selected changes', () => {
    const after = applyProposals(events, [props[0]]);
    expect(after.length).toBe(events.length);
  });
  it('proposes nothing without a profile and is idempotent after applying', () => {
    expect(optimizeSchedule(events, null, null)).toEqual([]);
    const after = applyProposals(events, props);
    const again = optimizeSchedule(after, p, DEMO_ANSWERS, 1).map((x) => x.kind);
    expect(again).not.toContain('reassign');
    expect(again).not.toContain('care-backup');
    expect(again).not.toContain('protect-study');
  });
});

describe('safety', () => {
  it('routes crisis language and returns no coaching', async () => {
    for (const t of ['I want to kill myself', 'my mother has chest pain', 'he is being abused', 'this is an emergency']) {
      expect(checkSafety(t).level).toBe('crisis');
      const r = await getCoachResponse(t, { profile: null, events: [], answers: null });
      expect(r.response.kind).toBe('safety');
      expect(r.response.plan).toEqual([]);
      expect(r.response.reflection).toMatch(/cannot monitor emergencies/);
      expect(r.response.reflection).not.toMatch(/\d{3,}/); // no invented hotline numbers
    }
  });
  it('does not flag ordinary coaching text', () => {
    for (const s of ['My child is stressed about exams.', 'We missed grandmother’s routine reminder.', 'Our weekly schedule is overloaded.']) {
      expect(checkSafety(s).level).toBe('none');
    }
  });
  it('adds a boundary note for diagnosis requests', async () => {
    const r = await getCoachResponse('can you diagnose my son?', { profile: null, events: [], answers: null });
    expect(r.response.safetyNote).toMatch(/does not diagnose/);
  });
});

describe('coach', () => {
  it('maps scenarios and free text', () => {
    expect(classifyScenario('My child is stressed about exams.')).toBe('exam');
    expect(classifyScenario('We missed grandmother’s routine reminder.')).toBe('care');
    expect(classifyScenario('Our weekly schedule is overloaded.')).toBe('overload');
    expect(classifyScenario('blah')).toBe('general');
  });
  it('returns complete responses for every scenario', () => {
    const ctx = { profile: demoProfile(), events: demoSchedule(), answers: DEMO_ANSWERS };
    for (const s of ['exam', 'time', 'tasks', 'care', 'conversation', 'disconnected', 'overload', 'general'] as const) {
      const r = buildCoachResponse(s, ctx);
      expect(r.reflection).toBeTruthy();
      expect(r.pattern).toBeTruthy();
      expect(r.todayAction.minutes).toBeLessThan(15);
      expect(r.weekSteps.length).toBe(3);
      expect(r.conversationStarter).toMatch(/\?$/);
      expect(r.why).toBeTruthy();
      expect(r.plan.length).toBeGreaterThan(0);
    }
  });
  it('personalizes the exam response for Al Noor', () => {
    const r = buildCoachResponse('exam', { profile: demoProfile(), events: demoSchedule(), answers: DEMO_ANSWERS });
    expect(r.weekSteps[0]).toBe('Move Zayed\'s Wednesday kitchen task to Omar.');
    expect(r.conversationStarter).toBe('What is one thing we can remove from this week to make it more manageable?');
  });
  it('rejects invalid remote output and falls back', async () => {
    expect(validateCoachResponse({ reflection: 'x' }, 'exam')).toBeNull();
    const failing = { id: 'remote', generate: async () => { throw new Error('down'); } };
    const r = await getCoachResponse('exams', { profile: demoProfile(), events: [], answers: null }, { provider: failing });
    expect(r.fellBack).toBe(true);
    expect(r.response.kind).toBe('coaching');
  });
  it('sanitizes remote output', () => {
    const ok = validateCoachResponse({
      reflection: 'Hello <script>alert(1)</script> there', pattern: 'p', conversationStarter: 'q?', why: 'w',
      todayAction: { title: 't', minutes: 10 }, weekSteps: ['a', 'b', 'c'],
    }, 'exam');
    expect(ok?.reflection).not.toContain('<');
  });
});

describe('storage', () => {
  it('round-trips and rejects corrupted data', () => {
    const raw = serialize({ a: 1 });
    expect(deserialize(raw, isObject)).toEqual({ a: 1 });
    expect(deserialize('{not json', isObject)).toBeNull();
    expect(deserialize(JSON.stringify({ v: 2, data: {} }), isObject)).toBeNull();
    expect(deserialize(null, isObject)).toBeNull();
    expect(deserialize(JSON.stringify({ v: 1, data: 5 }), isObject)).toBeNull();
  });
  it('saves and loads through a store', () => {
    expect(save(KEYS.profile, { x: 1 }, memoryStore)).toBe(true);
    expect(load(KEYS.profile, isObject, memoryStore)).toEqual({ x: 1 });
    const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(save('k', 1, broken)).toBe(false);
    expect(load('k', isObject, broken)).toBeNull();
  });
  it('sanitizes text', () => {
    expect(sanitizeText('<b>Hi</b>\u0000 there', 50)).toBe('Hi there');
    expect(sanitizeText('x'.repeat(300), 200).length).toBe(200);
    expect(sanitizeText(42 as unknown, 10)).toBe('');
  });
});

describe('time & care demo data', () => {
  it('handles time helpers', () => {
    expect(toMin('17:30')).toBe(1050);
    expect(fromMin(1050)).toBe('17:30');
    expect(overlaps('16:00', '17:30', '17:00', '18:00')).toBe(true);
    expect(overlaps('16:00', '17:00', '17:00', '18:00')).toBe(false);
  });
  it('seeds one missed required care reminder without backup', () => {
    const missed = demoCare().reminders.filter((r) => r.status === 'missed');
    expect(missed.length).toBe(1);
    expect(missed[0].required).toBe(true);
    expect(missed[0].backupId).toBeUndefined();
  });
});
