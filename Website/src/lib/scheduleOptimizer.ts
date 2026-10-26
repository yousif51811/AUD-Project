import type {
  AssessmentAnswers,
  DayIndex,
  FamilyMember,
  HouseholdProfile,
  OptimizationProposal,
  ScheduleChange,
  ScheduleEvent,
} from '@/types';
import { DAY_NAMES, fromMin, overlaps, toMin } from './time';
import { carrierAndHelper, eventMinutes, responsibilityLoad, student } from './people';

/* ---------- Analysis helpers ---------- */

export interface Conflict {
  a: ScheduleEvent;
  b: ScheduleEvent;
  memberIds: string[];
}

export function detectConflicts(events: ScheduleEvent[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.day !== b.day || !overlaps(a.start, a.end, b.start, b.end)) continue;
      const shared = a.assigneeIds.filter((id) => b.assigneeIds.includes(id));
      if (shared.length) out.push({ a, b, memberIds: shared });
    }
  }
  return out;
}

const LOAD_EXCLUDED: ScheduleEvent['category'][] = ['Rest'];
export const OVERLOAD_MINUTES = 600;

/** Scheduled minutes per member on a day (rest excluded). */
export function dayLoad(events: ScheduleEvent[], day: DayIndex): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.day !== day || LOAD_EXCLUDED.includes(e.category)) continue;
    for (const id of e.assigneeIds) out[id] = (out[id] ?? 0) + eventMinutes(e);
  }
  return out;
}

export function overloadedMembers(events: ScheduleEvent[], day: DayIndex): string[] {
  const load = dayLoad(events, day);
  return Object.entries(load).filter(([, m]) => m > OVERLOAD_MINUTES).map(([id]) => id);
}

function isFree(events: ScheduleEvent[], memberIds: string[], day: DayIndex, start: number, end: number, ignoreId?: string): boolean {
  return !events.some(
    (e) =>
      e.id !== ignoreId &&
      e.day === day &&
      e.assigneeIds.some((id) => memberIds.includes(id)) &&
      toMin(e.start) < end &&
      start < toMin(e.end),
  );
}

export function findSlot(
  events: ScheduleEvent[],
  memberIds: string[],
  day: DayIndex,
  duration: number,
  from: string,
  to: string,
  step = 15,
  ignoreId?: string,
): { start: string; end: string } | null {
  const lo = toMin(from);
  const hi = toMin(to);
  for (let s = lo; s + duration <= hi; s += step) {
    if (isFree(events, memberIds, day, s, s + duration, ignoreId)) return { start: fromMin(s), end: fromMin(s + duration) };
  }
  return null;
}

/* ---------- Optimizer ---------- */

function applyChange(events: ScheduleEvent[], c: ScheduleChange): ScheduleEvent[] {
  if (c.op === 'add') return [...events, c.event];
  return events.map((e) => (e.id === c.eventId ? { ...e, ...c.patch } : e));
}

export function applyChanges(events: ScheduleEvent[], changes: ScheduleChange[]): ScheduleEvent[] {
  return changes.reduce(applyChange, events);
}

export function applyProposals(events: ScheduleEvent[], proposals: OptimizationProposal[]): ScheduleEvent[] {
  return applyChanges(events, proposals.flatMap((p) => p.changes));
}

const nm = (members: FamilyMember[], id: string) => members.find((m) => m.id === id)?.name ?? 'a family member';

/**
 * Deterministic schedule optimizer. It only proposes changes; applying them is always a separate,
 * confirmed action.
 */
export function optimizeSchedule(
  events: ScheduleEvent[],
  profile: HouseholdProfile | null,
  answers: AssessmentAnswers | null,
  today: DayIndex = 1,
): OptimizationProposal[] {
  if (!profile) return [];
  const members = profile.members;
  const proposals: OptimizationProposal[] = [];
  let work = [...events];
  const push = (p: OptimizationProposal) => {
    proposals.push(p);
    work = applyChanges(work, p.changes);
  };
  const { helper } = carrierAndHelper(profile, events);
  const stu = student(profile);
  const examDays = events.filter((e) => e.exam).map((e) => ({ day: e.day, who: e.assigneeIds }));
  const stressed = answers ? answers.student !== 'none' : examDays.length > 0;

  /* 1. Move a nonurgent task away from exam night */
  if (helper && examDays.length) {
    const windowDays = new Set<number>();
    examDays.forEach((x) => { windowDays.add(x.day); windowDays.add(x.day - 1); });
    const candidates = events
      .filter((e) => e.flexible && e.category === 'Household Tasks' && e.day >= today && windowDays.has(e.day) && examDays.some((x) => e.assigneeIds.some((id) => x.who.includes(id))) && !e.assigneeIds.includes(helper.id))
      .sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
    const first = candidates[0];
    if (first && isFree(work, [helper.id], first.day, toMin(first.start), toMin(first.end), first.id)) {
      const from = nm(members, first.assigneeIds[0]);
      push({
        id: `opt-reassign-${first.id}`,
        kind: 'reassign',
        title: `Move “${first.title}” from ${from} to ${helper.name}`,
        detail: `${DAY_NAMES[first.day]}, ${first.start}–${first.end}`,
        signal: 'Student pressure with an assessment close by',
        why: `${DAY_NAMES[first.day]} is right before an assessment and ${from} already has a full day. This task is nonurgent, and ${helper.name} is free at that time.`,
        changes: [{ op: 'update', eventId: first.id, patch: { assigneeIds: [helper.id] } }],
      });
    }
  }

  /* 2. Share one flexible task from the most-loaded adult (reduces concentration) */
  if (helper) {
    const load = responsibilityLoad(work, members);
    const total = Object.values(load).reduce((a, b) => a + b, 0);
    const top = Object.entries(load).sort((a, b) => b[1] - a[1])[0];
    if (top && total > 0 && top[1] / total >= 0.45 && top[0] !== helper.id) {
      const cand = work
        .filter((e) => e.flexible && e.category === 'Household Tasks' && e.assigneeIds.length === 1 && e.assigneeIds[0] === top[0] && e.day >= today)
        .sort((a, b) => eventMinutes(b) - eventMinutes(a) || a.day - b.day)[0];
      if (cand && isFree(work, [helper.id], cand.day, toMin(cand.start), toMin(cand.end), cand.id)) {
        const owner = nm(members, top[0]);
        push({
          id: `opt-share-${cand.id}`,
          kind: 'share',
          title: `Share “${cand.title}” between ${owner} and ${helper.name}`,
          detail: `${DAY_NAMES[cand.day]}, ${cand.start}–${cand.end}`,
          signal: 'Household responsibilities concentrated on one person',
          why: `${owner} currently holds ${Math.round((top[1] / total) * 100)}% of scheduled responsibility time. Sharing one flexible planning task is a small first step.`,
          changes: [{ op: 'update', eventId: cand.id, patch: { assigneeIds: [top[0], helper.id] } }],
        });
      }
    }
  }

  /* 3. Protect study blocks before assessments */
  if (stu && stressed) {
    for (const x of examDays.filter((d) => d.who.includes(stu.id)).sort((a, b) => a.day - b.day)) {
      const target = (x.day - 1) as DayIndex;
      if (target < today) continue;
      const study = work.filter((e) => e.day === target && e.category === 'Study' && e.assigneeIds.includes(stu.id));
      const conflicted = study.find((s) => detectConflicts(work).some((c) => c.a.id === s.id || c.b.id === s.id));
      const alreadyProtected = study.some((s) => s.protected);
      if (alreadyProtected || (study.length > 0 && !conflicted)) continue;
      const slot = findSlot(work, [stu.id], target, 90, '17:00', '20:00', 30, conflicted?.id);
      if (!slot) continue;
      if (conflicted) {
        push({
          id: `opt-study-${target}`,
          kind: 'protect-study',
          title: `Protect ${stu.name}'s ${DAY_NAMES[target]} study block`,
          detail: `Move “${conflicted.title}” to ${slot.start}–${slot.end}`,
          signal: 'Study block overlaps another commitment',
          why: `The ${DAY_NAMES[target]} study block overlaps another activity the day before an assessment. A clear, protected slot before 8 PM replaces it.`,
          changes: [{ op: 'update', eventId: conflicted.id, patch: { start: slot.start, end: slot.end, protected: true, title: 'Protected study block' } }],
        });
      } else {
        push({
          id: `opt-study-${target}`,
          kind: 'protect-study',
          title: `Protect ${stu.name}'s ${DAY_NAMES[target]} study block`,
          detail: `Add a protected block ${slot.start}–${slot.end}`,
          signal: 'Assessment tomorrow with no study time protected',
          why: `An assessment follows on ${DAY_NAMES[x.day]} and no study block is planned. A protected slot before 8 PM adds focus time without removing family time.`,
          changes: [{ op: 'add', event: { id: `opt-ev-study-${target}`, title: 'Protected study block', day: target, start: slot.start, end: slot.end, category: 'Study', assigneeIds: [stu.id], done: false, protected: true } }],
        });
      }
    }
  }

  /* 4. Recovery after a dense school day (students and children only) */
  for (let d = today; d <= 6; d++) {
    const day = d as DayIndex;
    for (const m of members.filter((x) => x.ageGroup === 'teen' || x.ageGroup === 'child')) {
      if (!overloadedMembers(events, day).includes(m.id)) continue;
      if (work.some((e) => e.day === day && e.category === 'Rest' && e.assigneeIds.includes(m.id))) continue;
      const slot = findSlot(work, [m.id], day, 30, '20:15', '22:00', 15);
      if (!slot) continue;
      push({
        id: `opt-rest-${m.id}-${day}`,
        kind: 'recovery',
        title: `Protect recovery time for ${m.name} on ${DAY_NAMES[day]}`,
        detail: `Quiet recovery ${slot.start}–${slot.end}`,
        signal: 'Dense day with little recovery',
        why: `${DAY_NAMES[day]} holds more than ten hours of scheduled commitments for ${m.name}. A short recovery block helps sleep stay on track.`,
        changes: [{ op: 'add', event: { id: `opt-ev-rest-${m.id}-${day}`, title: 'Quiet recovery time', day, start: slot.start, end: slot.end, category: 'Rest', assigneeIds: [m.id], done: false, protected: true } }],
      });
    }
  }

  /* 5. Backup for care reminders */
  if (helper) {
    const groups = new Map<string, ScheduleEvent[]>();
    for (const e of events.filter((x) => x.careReminder && !x.backupId)) {
      const arr = groups.get(e.title) ?? [];
      arr.push(e);
      groups.set(e.title, arr);
    }
    for (const [title, evs] of groups) {
      const freeAll = evs.every((e) => isFree(work, [helper.id], e.day, toMin(e.start), toMin(e.end)));
      if (!freeAll || evs.every((e) => e.assigneeIds.includes(helper.id))) continue;
      const primary = nm(members, evs[0].assigneeIds[0]);
      push({
        id: `opt-backup-${evs[0].id}`,
        kind: 'care-backup',
        title: `Assign ${helper.name} as backup for “${title}”`,
        detail: `${evs.length} reminder${evs.length === 1 ? '' : 's'} this week, primary: ${primary}`,
        signal: 'Care reminder has no backup',
        why: `If ${primary} is busy, a missed reminder has no safety net. ${helper.name} is free at that time. Backup notifications are only sent when the family has agreed in advance.`,
        changes: evs.map((e) => ({ op: 'update' as const, eventId: e.id, patch: { backupId: helper.id } })),
      });
    }
  }

  /* 6. Family connection and family time */
  const needsTime = !answers || answers.familyTime !== 'fourPlus';
  const everyone = members.map((m) => m.id);
  if (needsTime && answers && (answers.communication !== 'strong' || answers.familyTime === 'once' || answers.familyTime === 'none')) {
    for (let i = 0; i < 7; i++) {
      const day = ((today + i) % 7) as DayIndex;
      const slot = findSlot(work, everyone, day, 10, '19:30', '21:00', 15);
      if (!slot) continue;
      push({
        id: `opt-connect-${day}`,
        kind: 'connect',
        title: `Add a 10-minute family check-in on ${DAY_NAMES[day]}`,
        detail: `After dinner, ${slot.start}–${slot.end}`,
        signal: 'Limited family time and uneasy conversations',
        why: 'Everyone is free in this window and a short, structured check-in is the lightest way to restart conversation.',
        changes: [{ op: 'add', event: { id: `opt-ev-connect-${day}`, title: 'Family check-in (10 min)', day, start: slot.start, end: slot.end, category: 'Family Time', assigneeIds: everyone, done: false } }],
      });
      break;
    }
  }
  if (needsTime) {
    const windows = profile.preferences.windows.length ? profile.preferences.windows : [{ day: 4 as DayIndex, start: '18:00', end: '20:00' }];
    for (const w of windows) {
      const slot = findSlot(work, everyone, w.day, 30, w.start, w.end, 15);
      if (!slot) continue;
      push({
        id: `opt-walk-${w.day}`,
        kind: 'family-time',
        title: `Schedule a family walk on ${DAY_NAMES[w.day]}`,
        detail: `${slot.start}–${slot.end}, indoor alternative ready`,
        signal: 'Shared free window not yet used',
        why: `${DAY_NAMES[w.day]} evening is a shared free window for everyone. Using it adds togetherness without removing anything.`,
        changes: [{ op: 'add', event: { id: `opt-ev-walk-${w.day}`, title: 'Family walk (or indoor alternative)', day: w.day, start: slot.start, end: slot.end, category: 'Family Time', assigneeIds: everyone, done: false } }],
      });
      break;
    }
  }

  return proposals;
}
