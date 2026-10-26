import type {
  AssessmentAnswers,
  DayIndex,
  HouseholdProfile,
  PlanAction,
  PlanActionTemplate,
  PlanCategory,
  ScheduleEvent,
  WeeklyPlan,
} from '@/types';
import { generateRecommendations } from './recommendations';
import { adults, carrierAndHelper, elder, student, youngStudent } from './people';

export const MAX_ACTIONS_PER_DAY = 2;

export function resolveWho(tokens: string[], profile: HouseholdProfile | null, events: ScheduleEvent[] = []): string[] {
  if (!profile) return [];
  const { carrier, helper } = carrierAndHelper(profile, events);
  const ids = new Set<string>();
  for (const t of tokens) {
    if (t === 'all') profile.members.forEach((m) => ids.add(m.id));
    else if (t === 'student') student(profile) && ids.add(student(profile)!.id);
    else if (t === 'youngStudent') youngStudent(profile) && ids.add(youngStudent(profile)!.id);
    else if (t === 'elder') elder(profile) && ids.add(elder(profile)!.id);
    else if (t === 'adults') adults(profile).forEach((m) => ids.add(m.id));
    else if (t === 'carrier') carrier && ids.add(carrier.id);
    else if (t === 'helper') helper && ids.add(helper.id);
  }
  return [...ids];
}

interface Filler {
  day: DayIndex;
  title: string;
  minutes: number;
  who: string[];
  category: PlanCategory;
  reason: string;
}

const FILLERS: Filler[] = [
  { day: 0, title: 'Ten-minute walk together after school or work', minutes: 10, who: ['all'], category: 'connection', reason: 'A gentle start to the week that needs no preparation.' },
  { day: 1, title: 'Cook or prepare one dish together', minutes: 30, who: ['all'], category: 'connection', reason: 'Shared tasks make time together feel natural.' },
  { day: 2, title: 'Fifteen minutes of quiet time for everyone', minutes: 15, who: ['all'], category: 'rest', reason: 'Midweek recovery keeps the rest of the week manageable.' },
  { day: 3, title: 'Call or visit a relative together', minutes: 20, who: ['all'], category: 'connection', reason: 'Extended family contact strengthens support.' },
  { day: 4, title: 'Shared family meal without screens', minutes: 40, who: ['all'], category: 'connection', reason: 'A predictable shared meal anchors the weekend.' },
  { day: 5, title: 'Family game or creative activity', minutes: 30, who: ['all'], category: 'connection', reason: 'Playful time lowers everyday pressure.' },
  { day: 6, title: 'Gratitude reflection and next-week planning', minutes: 15, who: ['all'], category: 'reflection', reason: 'A weekly reflection keeps the plan adaptable.' },
];

export const ALTERNATES: Record<PlanCategory, { title: string; minutes: number; reason: string }[]> = {
  connection: [
    { title: 'Family walk, or an indoor stretch together', minutes: 20, reason: 'Movement and conversation without needing a plan.' },
    { title: 'Share a dessert and one good moment from the day', minutes: 15, reason: 'Small rituals are easy to repeat.' },
    { title: 'Board or card game night', minutes: 30, reason: 'Playful time lowers pressure.' },
  ],
  balance: [
    { title: 'Rotate one household task for the week', minutes: 10, reason: 'Rotation keeps the balance visible without blame.' },
    { title: 'Ten-minute household reset, everyone together', minutes: 10, reason: 'Many hands make a small task lighter.' },
  ],
  study: [
    { title: 'Focused study block with a 5-minute break halfway', minutes: 50, reason: 'Short breaks protect focus.' },
    { title: 'Review plan for the next assessment with a parent', minutes: 20, reason: 'A clear plan reduces pressure.' },
  ],
  care: [
    { title: 'Short call with an older family member', minutes: 15, reason: 'Regular contact keeps routines and connection steady.' },
    { title: 'Review the care routine card together', minutes: 10, reason: 'A shared routine card helps everyone remember.' },
  ],
  rest: [
    { title: 'Wind-down evening with screens off', minutes: 30, reason: 'A predictable evening supports sleep.' },
    { title: 'Fifteen minutes of quiet reading or music', minutes: 15, reason: 'Quiet time supports recovery.' },
  ],
  reflection: [
    { title: 'Write one gratitude note for a family member', minutes: 10, reason: 'Appreciation keeps the tone positive.' },
    { title: 'Name one win and one wish for next week', minutes: 10, reason: 'A short reflection makes the plan adaptable.' },
  ],
};

export function generatePlan(
  answers: AssessmentAnswers | null,
  profile: HouseholdProfile | null,
  events: ScheduleEvent[] = [],
  opts: { isSample?: boolean } = {},
): WeeklyPlan {
  const maxDaily = profile?.preferences.maxDailyMinutes ?? 90;
  const recs = answers ? generateRecommendations(answers, profile, events) : [];
  const byDay: Record<number, { action: PlanAction; priority: number }[]> = {};
  for (const r of recs) {
    r.plan.forEach((t, i) => {
      const id = `plan-${r.id.replace('rec-', '')}-${i}`;
      (byDay[t.day] ||= []).push({
        priority: r.priority - i * 0.1,
        action: {
          id,
          day: t.day,
          title: t.title,
          reason: t.reason,
          participantIds: resolveWho(t.who, profile, events),
          minutes: t.minutes,
          done: false,
          category: t.category,
          recId: r.id,
          source: 'engine',
        },
      });
    });
  }
  const actions: PlanAction[] = [];
  const dropped: PlanAction[] = [];
  for (let d = 0 as DayIndex; d <= 6; d = (d + 1) as DayIndex) {
    const list = (byDay[d] ?? []).sort((a, b) => b.priority - a.priority);
    let used = 0;
    const kept: PlanAction[] = [];
    for (const { action } of list) {
      if (kept.length >= MAX_ACTIONS_PER_DAY) { dropped.push(action); continue; }
      if (kept.length > 0 && used + action.minutes > maxDaily) { dropped.push(action); continue; }
      kept.push(action);
      used += action.minutes;
    }
    if (kept.length === 0) {
      const f = FILLERS[d];
      kept.push({ id: `plan-fill-${d}`, day: d, title: f.title, reason: f.reason, participantIds: resolveWho(f.who, profile, events), minutes: f.minutes, done: false, category: f.category, source: 'engine' });
    }
    actions.push(...kept);
  }
  return { actions, parked: [], reduced: false, isSample: !!opts.isSample };
}

/** Reduce Workload: keep only the highest-priority action per day; park the rest so they can return. */
export function setReduced(plan: WeeklyPlan, reduced: boolean): WeeklyPlan {
  if (reduced === plan.reduced) return plan;
  if (reduced) {
    const keep: PlanAction[] = [];
    const park: PlanAction[] = [...plan.parked];
    const seen = new Set<number>();
    for (const a of plan.actions) {
      if (!seen.has(a.day)) { seen.add(a.day); keep.push(a); } else park.push(a);
    }
    return { ...plan, actions: keep, parked: park, reduced: true };
  }
  const merged = [...plan.actions, ...plan.parked].sort((a, b) => a.day - b.day);
  return { ...plan, actions: merged, parked: [], reduced: false };
}

export function actionsByDay(plan: WeeklyPlan): PlanAction[][] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => plan.actions.filter((a) => a.day === d));
}

export function alternativesFor(a: PlanAction) {
  return ALTERNATES[a.category].filter((x) => x.title !== a.title);
}

export function replaceAction(plan: WeeklyPlan, id: string, alt: { title: string; minutes: number; reason: string }): WeeklyPlan {
  return { ...plan, isSample: false, actions: plan.actions.map((a) => (a.id === id ? { ...a, title: alt.title, minutes: alt.minutes, reason: alt.reason, done: false, source: 'user' } : a)) };
}

/** Deterministically cycles to the next alternative in the same category. */
export function regenerateAction(plan: WeeklyPlan, id: string): WeeklyPlan {
  const a = plan.actions.find((x) => x.id === id);
  if (!a) return plan;
  const pool = ALTERNATES[a.category];
  const idx = pool.findIndex((x) => x.title === a.title);
  const next = pool[(idx + 1) % pool.length];
  return replaceAction(plan, id, next);
}

export function addActionsToPlan(
  plan: WeeklyPlan | null,
  templates: PlanActionTemplate[],
  profile: HouseholdProfile | null,
  events: ScheduleEvent[],
  source: PlanAction['source'] = 'coach',
): { plan: WeeklyPlan; added: PlanAction[]; skipped: number } {
  const base: WeeklyPlan = plan ?? { actions: [], parked: [], reduced: false, isSample: false };
  let actions = [...base.actions];
  const added: PlanAction[] = [];
  let skipped = 0;
  for (const t of templates) {
    if (actions.some((a) => a.title === t.title)) { skipped += 1; continue; }
    let day: DayIndex | null = null;
    for (let i = 0; i < 7; i++) {
      const d = ((t.day + i) % 7) as DayIndex;
      if (actions.filter((a) => a.day === d).length < MAX_ACTIONS_PER_DAY) { day = d; break; }
    }
    if (day === null) { skipped += 1; continue; }
    const action: PlanAction = {
      id: `plan-${source}-${Math.random().toString(36).slice(2, 8)}`,
      day,
      title: t.title,
      reason: t.reason,
      participantIds: resolveWho(t.who, profile, events),
      minutes: t.minutes,
      done: false,
      category: t.category,
      source,
    };
    actions.push(action);
    added.push(action);
  }
  actions = actions.sort((a, b) => a.day - b.day);
  return { plan: { ...base, actions, isSample: false }, added, skipped };
}
