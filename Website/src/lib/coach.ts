import type {
  AssessmentAnswers,
  CoachResponse,
  CoachScenarioId,
  HouseholdProfile,
  ScheduleEvent,
} from '@/types';
import { COACH_SCENARIOS } from '@/data/copy';
import { ANSWER_LABELS } from './scoring';
import { carrierAndHelper, elder, nameOf, student } from './people';

export interface CoachContext {
  profile: HouseholdProfile | null;
  events: ScheduleEvent[];
  answers: AssessmentAnswers | null;
}

/** Map free text to the closest scenario. Chips map directly. */
export function classifyScenario(text: string): CoachScenarioId {
  const t = text.toLowerCase();
  const exact = COACH_SCENARIOS.find((s) => s.label.toLowerCase() === t);
  if (exact) return exact.id;
  let best: { id: CoachScenarioId; score: number } = { id: 'general', score: 0 };
  for (const s of COACH_SCENARIOS) {
    const score = s.keywords.reduce((n, k) => (t.includes(k) ? n + 1 : n), 0);
    if (score > best.score) best = { id: s.id, score };
  }
  return best.id;
}

export function buildCoachResponse(scenario: CoachScenarioId, ctx: CoachContext): CoachResponse {
  const { carrier, helper } = carrierAndHelper(ctx.profile, ctx.events);
  const stu = nameOf(student(ctx.profile), 'your student');
  const hlp = nameOf(helper, 'another adult');
  const car = nameOf(carrier, 'one person');
  const eld = nameOf(elder(ctx.profile), 'your older family member');
  const a = ctx.answers;

  const kitchen = ctx.events.find((e) => e.flexible && e.category === 'Household Tasks' && e.day === 2 && student(ctx.profile) && e.assigneeIds.includes(student(ctx.profile)!.id));
  const base = { source: 'deterministic' as const, kind: 'coaching' as const, scenario };

  switch (scenario) {
    case 'exam': {
      const pressure = a ? ANSWER_LABELS.student[a.student].toLowerCase() : 'high';
      const sleep = a ? ANSWER_LABELS.sleep[a.sleep].toLowerCase() : 'inconsistent';
      return {
        ...base,
        reflection: 'It sounds as if exam pressure is spreading into family time. That is very common, and it does not mean anyone is doing something wrong.',
        pattern: `Study pressure is ${pressure} while sleep is ${sleep} and Wednesday contains several responsibilities.`,
        todayAction: { title: '10-minute check-in after dinner: each person shares one pressure and one request', minutes: 10 },
        weekSteps: [
          kitchen ? `Move ${stu}'s Wednesday kitchen task to ${hlp}.` : `Move one nonurgent chore from ${stu} to ${hlp}.`,
          'Protect a study block before 8 PM, with a 5-minute break halfway through.',
          'Agree a screens-down time so sleep stays steady before the assessments.',
        ],
        conversationStarter: 'What is one thing we can remove from this week to make it more manageable?',
        why: 'Removing a commitment is more realistic than adding another one. A short check-in makes the pressure visible, and a protected study block gives focus without taking away family time.',
        safetyNote: 'If exam stress feels unmanageable or affects health, a teacher, school counsellor or qualified professional can help.',
        plan: [
          { title: 'Exam-week check-in: one pressure, one request', day: 1, minutes: 10, who: ['all'], category: 'connection', reason: 'Makes exam pressure visible before it spreads.' },
          { title: `Protected study block for ${stu}`, day: 2, minutes: 60, who: ['student'], category: 'study', reason: 'Gives focus time without adding a commitment.' },
        ],
      };
    }
    case 'time':
      return {
        ...base,
        reflection: 'It sounds like the week is full and shared time keeps slipping away, which can leave everyone feeling a little apart.',
        pattern: 'Family time was limited this week, while evenings are crowded with separate commitments.',
        todayAction: { title: 'A 5-minute “one good moment” round at dinner', minutes: 5 },
        weekSteps: [
          'Protect the Friday evening window for a 30-minute walk, with an indoor alternative ready.',
          'Add a 10-minute check-in after dinner on a calm evening.',
          'Choose one weekend meal where phones stay in another room.',
        ],
        conversationStarter: 'What is one small thing we would all enjoy doing together this week?',
        why: 'Small, predictable moments are easier to keep than large plans, and they use windows that already exist.',
        plan: [
          { title: '30-minute family walk (or indoor alternative)', day: 4, minutes: 30, who: ['all'], category: 'connection', reason: 'Uses a free shared window.' },
          { title: 'Shared meal with phones away', day: 5, minutes: 40, who: ['all'], category: 'connection', reason: 'A predictable shared meal anchors the weekend.' },
        ],
      };
    case 'tasks':
      return {
        ...base,
        reflection: 'It sounds like one person is carrying a lot of the planning, and that can feel invisible to everyone else.',
        pattern: `Household planning and chores are concentrated on ${car}.`,
        todayAction: { title: 'Each person names one task they could take this week', minutes: 10 },
        weekSteps: [
          `Share one planning task, such as weekly grocery planning, with ${hlp}.`,
          'List this week’s tasks on one shared page so the work becomes visible.',
          'Review the balance together on Saturday, appreciation first.',
        ],
        conversationStarter: 'Which task would be easiest for you to take over for a week?',
        why: 'Naming tasks makes invisible work visible. Sharing one task is more likely to last than redesigning everything at once.',
        plan: [
          { title: 'Shared task list: everyone adds one chore they could take', day: 1, minutes: 10, who: ['all'], category: 'balance', reason: 'Makes invisible work visible.' },
          { title: 'Responsibility-balance reset over a shared meal', day: 5, minutes: 40, who: ['all'], category: 'balance', reason: 'A weekly reset keeps balance visible without blame.' },
        ],
      };
    case 'care':
      return {
        ...base,
        reflection: 'A missed reminder can feel worrying. It usually says more about a busy day than about how much anyone cares.',
        pattern: 'A time-sensitive reminder depended on one person.',
        todayAction: { title: `Ask ${eld} what feels comfortable, and agree on a backup person`, minutes: 10 },
        weekSteps: [
          `Add ${hlp} as backup, with ${eld}'s agreement.`,
          'Mark the most important reminders as required, so a backup is only notified for those.',
          `Plan a short family call this week so the routine also feels connected.`,
        ],
        conversationStarter: 'What would make our reminders feel supportive rather than like checking up?',
        why: 'A backup who is agreed in advance turns a single point of failure into a safety net while keeping dignity and choice.',
        safetyNote: `If a missed routine involves medication and you are worried about ${eld}'s health, contact their doctor or pharmacist.`,
        plan: [
          { title: `Agree a care backup for ${eld}`, day: 1, minutes: 10, who: ['elder', 'helper'], category: 'care', reason: 'A backup keeps routines steady on busy days.' },
          { title: `${eld}'s family call and memory activity`, day: 3, minutes: 20, who: ['elder', 'youngStudent'], category: 'care', reason: 'A call strengthens connection and routine.' },
        ],
      };
    case 'conversation':
      return {
        ...base,
        reflection: 'When important conversations become arguments, it often means people feel unheard, not that they care less.',
        pattern: 'Heated conversations tend to start when people are tired, rushed or interrupted.',
        todayAction: { title: 'Agree a pause word and a 10-minute time-out rule', minutes: 5 },
        weekSteps: [
          'Choose a calm time for hard topics, not right after school or work.',
          'Use “I notice… I need…” statements, one person at a time.',
          'End each hard conversation with one thing you agree on.',
        ],
        conversationStarter: 'What would help you feel heard when we talk about something difficult?',
        why: 'A shared pause rule gives everyone permission to cool down, which keeps the topic from becoming a contest.',
        safetyNote: 'If arguments involve fear, threats or anyone feeling unsafe, contact a trusted adult or a qualified professional.',
        plan: [{ title: 'Agree a pause word and a calm time for hard topics', day: 0, minutes: 10, who: ['all'], category: 'connection', reason: 'A shared rule makes hard conversations safer.' }],
      };
    case 'disconnected':
      return {
        ...base,
        reflection: 'It can be hard to notice someone drifting away, and it matters that you did.',
        pattern: 'One family member may be spending less time connecting, which can happen for many everyday reasons.',
        todayAction: { title: 'Send one warm, no-pressure message or invite them on a 10-minute walk', minutes: 10 },
        weekSteps: [
          'Offer a one-to-one activity they choose, rather than a group conversation.',
          'Ask one open question and listen without trying to fix.',
          'Let them decide how much to share, and respect it if they say no.',
        ],
        conversationStarter: 'I have missed spending time with you. What would feel good this week?',
        why: 'Low-pressure, one-to-one invitations are easier to accept than being asked to explain how they feel.',
        safetyNote: 'If they seem persistently low or you are worried about their wellbeing, encourage them to talk to a trusted adult or a qualified professional.',
        plan: [{ title: 'One-to-one time, chosen by them', day: 3, minutes: 20, who: ['all'], category: 'connection', reason: 'Low-pressure invitation to reconnect.' }],
      };
    case 'overload':
      return {
        ...base,
        reflection: 'A packed week can make everything feel urgent, even the things that could wait.',
        pattern: 'Several responsibilities overlap on the same days, leaving little room for recovery.',
        todayAction: { title: 'List the three least urgent commitments and choose one to postpone', minutes: 10 },
        weekSteps: [
          'Open the Smart Schedule and review proposed changes. Nothing moves until you confirm.',
          'Move one nonurgent task away from the busiest day.',
          'Protect one recovery block after the densest day.',
        ],
        conversationStarter: 'What is one thing we can remove from this week to make it more manageable?',
        why: 'Taking something away reduces pressure faster than adding a better system, and the family decides what goes.',
        plan: [{ title: 'Weekly schedule review: move or remove one commitment', day: 0, minutes: 15, who: ['adults'], category: 'balance', reason: 'A small review prevents overload.' }],
      };
    default:
      return {
        ...base,
        scenario: 'general',
        reflection: 'Thank you for sharing that. Let’s keep the next step small and realistic.',
        pattern: 'Small, realistic steps usually work better than big changes.',
        todayAction: { title: 'Write down the one thing that would make this week feel better', minutes: 10 },
        weekSteps: [
          'Share that one thing with a family member and ask what would help.',
          'Choose one small action you can all keep this week.',
          'Review how it went on Sunday, and keep, change or drop it.',
        ],
        conversationStarter: 'What is one thing that would make this week feel better for you?',
        why: 'Starting with the family’s own words keeps suggestions relevant and under the family’s control.',
        plan: [{ title: 'Gratitude reflection and next-week planning', day: 6, minutes: 15, who: ['all'], category: 'reflection', reason: 'A weekly reflection keeps the plan adaptable.' }],
      };
  }
}

/** The edited preview and the templates inserted into the weekly plan stay in sync. */
export function editCoachPlan(response: CoachResponse, plan: CoachResponse['plan']): CoachResponse {
  return { ...response, plan: plan.map((a) => ({ ...a, title: a.title.trim(), who: [...a.who] })) };
}
