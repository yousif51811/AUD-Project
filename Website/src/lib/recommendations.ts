import type {
  AssessmentAnswers,
  AssessmentResult,
  FamilySignal,
  FamilyStrength,
  HouseholdProfile,
  Recommendation,
  ScheduleEvent,
} from '@/types';
import {
  ANSWER_LABELS,
  DEDUCTION_TABLE,
  careDeduction,
  categoryScores,
  computeScore,
  deductionsFor,
  statusFor,
  statusKeyFor,
  summarize,
} from './scoring';
import { adults, carrierAndHelper, elder, nameOf, student, youngStudent } from './people';

interface Names {
  student: string;
  helper: string;
  carrier: string;
  elder: string;
  young: string;
}

function namesFor(profile: HouseholdProfile | null, events: ScheduleEvent[]): Names {
  const { carrier, helper } = carrierAndHelper(profile, events);
  return {
    student: nameOf(student(profile), 'your student'),
    helper: nameOf(helper ?? adults(profile)[0], 'another adult'),
    carrier: nameOf(carrier, 'the adult planning most tasks'),
    elder: nameOf(elder(profile), 'your older family member'),
    young: nameOf(youngStudent(profile), 'a younger family member'),
  };
}

export function buildSignals(a: AssessmentAnswers): FamilySignal[] {
  const s: FamilySignal[] = [];
  if (a.familyTime === 'once' || a.familyTime === 'none')
    s.push({ id: 'time', category: 'connection', severity: 'attention', label: a.familyTime === 'once' ? 'Quality family time occurred only once this week' : 'No intentional family time was reported this week', detail: 'Shared time is the easiest signal to lose in a busy week.' });
  else if (a.familyTime === 'twoThree')
    s.push({ id: 'time', category: 'connection', severity: 'watch', label: 'Family time was limited to two or three moments', detail: 'A little more protected time could help.' });
  if (a.stress === 'high' || a.stress === 'overwhelming')
    s.push({ id: 'stress', category: 'rest', severity: 'attention', label: `Household stress is ${ANSWER_LABELS.stress[a.stress].toLowerCase()}`, detail: 'Reported stress makes every extra commitment feel heavier.' });
  else if (a.stress === 'moderate')
    s.push({ id: 'stress', category: 'rest', severity: 'watch', label: 'Household stress is moderate', detail: 'Some busy or tense moments were reported.' });
  if (a.communication === 'limited' || a.communication === 'veryDifficult')
    s.push({ id: 'comm', category: 'connection', severity: 'attention', label: `Starting important conversations feels ${a.communication === 'limited' ? 'limited' : 'very difficult'}`, detail: 'A small, structured moment can make talking easier.' });
  else if (a.communication === 'comfortable')
    s.push({ id: 'comm', category: 'connection', severity: 'watch', label: 'Communication is moderate: generally comfortable', detail: 'Conversation is possible, but not always easy to start.' });
  if (a.tasks === 'uneven' || a.tasks === 'concentrated')
    s.push({ id: 'tasks', category: 'balance', severity: 'attention', label: a.tasks === 'uneven' ? 'Household responsibilities are uneven' : 'Responsibilities are concentrated on one person', detail: 'Sharing one task is usually a better first step than redesigning everything.' });
  else if (a.tasks === 'slightly')
    s.push({ id: 'tasks', category: 'balance', severity: 'watch', label: 'Household responsibilities are slightly uneven', detail: 'Planning and chores are not yet shared evenly.' });
  if (a.student === 'high' || a.student === 'severe')
    s.push({ id: 'student', category: 'student', severity: 'attention', label: `Student academic pressure is ${a.student}`, detail: 'Assessments are close, so protected focus time matters.' });
  else if (a.student === 'moderate')
    s.push({ id: 'student', category: 'student', severity: 'watch', label: 'Student academic pressure is moderate', detail: 'Workload is noticeable but manageable.' });
  if (a.elder === 'yes' && a.routines === 'repeated')
    s.push({ id: 'care', category: 'care', severity: 'attention', label: 'Older-adult routines were repeatedly missed', detail: 'Routine support needs a clearer backup.' });
  else if (a.elder === 'yes' && a.routines === 'occasional')
    s.push({ id: 'care', category: 'care', severity: 'watch', label: 'One older-adult routine reminder was missed', detail: 'A backup person can keep routines steady.' });
  if (a.sleep === 'poor')
    s.push({ id: 'sleep', category: 'rest', severity: 'attention', label: 'Sleep and recovery are poor across the household', detail: 'Rest affects patience, focus and mood.' });
  else if (a.sleep === 'inconsistent')
    s.push({ id: 'sleep', category: 'rest', severity: 'watch', label: 'Sleep and recovery are inconsistent', detail: 'Bedtimes and recovery time vary from day to day.' });
  return s;
}

export function buildStrengths(a: AssessmentAnswers, profile: HouseholdProfile | null, events: ScheduleEvent[] = []): FamilyStrength[] {
  const n = namesFor(profile, events);
  const out: FamilyStrength[] = [];
  const add = (id: string, label: string, detail: string) => out.push({ id, label, detail });
  const goalCount = a.goals.length;
  add('willing', 'The family is ready to act together', goalCount > 0 ? `You chose ${goalCount} shared goal${goalCount === 1 ? '' : 's'}, which makes the plan more personal.` : 'Completing a check-in together is itself a strong start.');
  if (a.communication === 'strong' || a.communication === 'comfortable')
    add('comm', 'Conversation is possible', 'Family members feel generally able to start important conversations.');
  if (a.elder === 'yes' && adults(profile).length >= 2)
    add('backup', `${n.helper} is available as a backup care person`, 'A trusted backup is already within the household.');
  if (a.elder === 'yes' && a.routines === 'none')
    add('care', 'Care routines are consistent', 'Routine support is working this week.');
  if (a.tasks === 'fair') add('tasks', 'Responsibilities feel fair', 'Planning and chores are shared evenly.');
  if (a.familyTime === 'fourPlus' || a.familyTime === 'twoThree') add('time', 'Shared time is happening', 'The family is making time to connect.');
  if (a.sleep === 'good') add('sleep', 'Rest is protected', 'Sleep and recovery are balanced.');
  if (a.stress === 'low') add('stress', 'Home feels calm', 'Household stress is reported as low.');
  return out.slice(0, 4);
}

export function generateRecommendations(
  a: AssessmentAnswers,
  profile: HouseholdProfile | null,
  events: ScheduleEvent[] = [],
): Recommendation[] {
  const n = namesFor(profile, events);
  const D = DEDUCTION_TABLE;
  const recs: (Recommendation & { order: number })[] = [];
  const goals = new Set([...(profile?.goals ?? []), ...a.goals]);

  if (a.student !== 'none') {
    const sleepNote = a.sleep !== 'good' ? ` while sleep is ${ANSWER_LABELS.sleep[a.sleep].toLowerCase()}` : '';
    recs.push({
      order: 1, id: 'rec-study', kind: 'study',
      title: 'Protect study time and ease one task',
      action: `Protect a study block for ${n.student} on Wednesday before 8 PM, and move one nonurgent chore to ${n.helper}.`,
      // Time-sensitive: assessments are close, so high pressure carries extra weight.
      priority: D.student[a.student] + D.sleep[a.sleep] + (goals.has('exam') ? 1 : 0) + (a.student === 'high' || a.student === 'severe' ? 2 : 0),
      signals: [`Student pressure: ${ANSWER_LABELS.student[a.student]}`, `Sleep and recovery: ${ANSWER_LABELS.sleep[a.sleep]}`],
      pattern: `Study pressure is ${ANSWER_LABELS.student[a.student].toLowerCase()}${sleepNote}, and Wednesday holds several responsibilities.`,
      why: `Study pressure is ${ANSWER_LABELS.student[a.student].toLowerCase()}${sleepNote} and Wednesday contains several responsibilities.`,
      whyAction: 'Removing something is more realistic than adding another activity. Moving one nonurgent chore and protecting a study block gives focus time without a new commitment.',
      control: `${n.student} and the household confirm the change. Nothing moves until you apply it.`,
      minutes: 60,
      benefit: `Gives ${n.student} uninterrupted focus time and one fewer evening obligation.`,
      alternative: 'Keep the chore, but shorten it to 15 minutes and start the study block earlier.',
      plan: [
        { title: `Protected study block for ${n.student}`, day: 2, minutes: 60, who: ['student'], category: 'study', reason: 'Study pressure and an upcoming assessment make focus time the priority.' },
        { title: 'Quiet recovery time after study', day: 2, minutes: 20, who: ['student'], category: 'rest', reason: 'Sleep is not yet steady, so winding down matters before bed.' },
      ],
    });
  }

  const connPts = D.familyTime[a.familyTime] + D.communication[a.communication];
  if (connPts > 0) {
    recs.push({
      order: 2, id: 'rec-checkin', kind: 'checkin',
      title: 'Hold a 10-minute family check-in after dinner',
      action: 'Let each person share one pressure and one request. No problem-solving, only listening.',
      priority: connPts + (goals.has('communicate') ? 1 : 0),
      signals: [`Intentional family time: ${ANSWER_LABELS.familyTime[a.familyTime]}`, `Conversation comfort: ${ANSWER_LABELS.communication[a.communication]}`],
      pattern: 'Little shared time and uneasy conversation tend to reinforce each other.',
      why: 'Family time was limited and starting conversations is not yet easy, so a short, structured moment lowers the barrier.',
      whyAction: 'Ten minutes with a clear format is easier to protect than a long family meeting.',
      control: 'Any member can skip a round or pass. The family picks the day.',
      minutes: 10,
      benefit: 'Makes pressures and requests visible before they pile up.',
      alternative: 'Try a shared walk or a written note on the fridge instead of a spoken check-in.',
      plan: [{ title: '10-minute family check-in after dinner', day: 0, minutes: 10, who: ['all'], category: 'connection', reason: 'Little shared time and uneasy conversation make a short, structured check-in the lightest first step.' }],
    });
  }

  const careDed = careDeduction(a);
  if (a.elder === 'yes' && a.routines !== 'none') {
    recs.push({
      order: 3, id: 'rec-care', kind: 'care',
      title: `Add ${n.helper} as backup for ${n.elder}'s care reminders`,
      action: `Agree on one backup person for ${n.elder}'s routine reminders, and plan a family call this week.`,
      priority: careDed + (goals.has('care') ? 1 : 0),
      signals: [`Care routines: ${ANSWER_LABELS.routines[a.routines]}`],
      pattern: 'A single person holding a time-sensitive reminder leaves routines fragile on busy days.',
      why: 'A routine reminder was missed. A second person turns a single point of failure into a safety net.',
      whyAction: 'A backup only notified when agreed in advance keeps dignity and avoids constant checking.',
      control: `${n.elder} and ${n.helper} both agree first. Backup alerts are sent only for reminders marked required.`,
      minutes: 15,
      benefit: 'Keeps routines steady on days when the usual person is busy.',
      alternative: 'Use a shared written routine card instead of a backup notification.',
      plan: [{ title: `${n.elder}'s family call and memory activity`, day: 3, minutes: 20, who: ['elder', 'youngStudent'], category: 'care', reason: 'A missed reminder shows how fragile routines can be; a call also strengthens connection.' }],
    });
  }

  if (a.tasks !== 'fair') {
    recs.push({
      order: 4, id: 'rec-balance', kind: 'balance',
      title: `Share ${n.carrier}'s grocery-planning task`,
      action: `Share one recurring planning task with ${n.helper} and reset the household balance on Saturday.`,
      priority: D.tasks[a.tasks] + (goals.has('balance') ? 1 : 0),
      signals: [`Task distribution: ${ANSWER_LABELS.tasks[a.tasks]}`],
      pattern: 'Invisible planning work tends to stay with one person unless it is named.',
      why: 'Responsibilities are not evenly shared, so naming one task and sharing it is a small, fair first step.',
      whyAction: 'One shared task is more likely to last than a full redesign.',
      control: 'The family decides which task moves and for how long.',
      minutes: 20,
      benefit: 'Reduces the weight of planning on one person.',
      alternative: 'Rotate one task weekly instead of sharing it.',
      plan: [
        { title: `Share ${n.carrier}'s grocery planning with ${n.helper}`, day: 1, minutes: 20, who: ['carrier', 'helper'], category: 'balance', reason: 'Responsibilities are uneven; sharing one planning task is a small first step.' },
        { title: 'Responsibility-balance reset over a shared meal', day: 5, minutes: 40, who: ['all'], category: 'balance', reason: 'A weekly reset keeps the balance visible without blame.' },
      ],
    });
  }

  if (a.familyTime !== 'fourPlus' || goals.has('quality-time') || a.stress === 'high' || a.stress === 'overwhelming') {
    const walk = (profile?.preferences.activities ?? ['walk']).includes('walk');
    recs.push({
      order: 5, id: 'rec-window', kind: 'window',
      title: walk ? 'Protect a Friday family walk' : 'Protect a Friday family evening',
      action: walk ? 'Use the shared Friday window for a 30-minute walk, with an indoor alternative ready.' : 'Use the shared Friday window for 30 minutes of something you all enjoy.',
      priority: Math.ceil(D.familyTime[a.familyTime] / 3) + (a.stress === 'high' || a.stress === 'overwhelming' ? 2 : 0),
      signals: [`Shared time window: Friday evening`, `Intentional family time: ${ANSWER_LABELS.familyTime[a.familyTime]}`],
      pattern: 'A shared open window exists, but nothing is planned inside it.',
      why: 'Friday evening is free for everyone, and family time has been limited.',
      whyAction: 'Using a window that already exists adds togetherness without removing anything else.',
      control: 'Anyone can swap the activity. The indoor option keeps it flexible.',
      minutes: 30,
      benefit: 'Turns a free window into planned togetherness.',
      alternative: 'A shared meal or a game evening in the same window.',
      plan: [{ title: walk ? '30-minute family walk (or indoor alternative)' : '30-minute family evening activity', day: 4, minutes: 30, who: ['all'], category: 'connection', reason: 'Friday evening is a shared free window and family time has been limited.' }],
    });
  }

  if (a.sleep !== 'good' && a.student === 'none') {
    recs.push({
      order: 6, id: 'rec-rest', kind: 'rest',
      title: 'Protect a wind-down evening',
      action: 'Agree a screens-down time on one evening and keep it for the whole household.',
      priority: D.sleep[a.sleep],
      signals: [`Sleep and recovery: ${ANSWER_LABELS.sleep[a.sleep]}`],
      pattern: 'Inconsistent bedtimes tend to spread across the household.',
      why: 'Sleep is not yet steady, so one predictable evening is a manageable start.',
      whyAction: 'One protected evening is easier than a new nightly rule.',
      control: 'The family picks the evening and the time.',
      minutes: 30,
      benefit: 'Creates one predictable recovery point in the week.',
      alternative: 'Move the bedtime 15 minutes earlier on school nights.',
      plan: [{ title: 'Wind-down evening with screens off', day: 3, minutes: 30, who: ['all'], category: 'rest', reason: 'Sleep is not yet steady; a shared wind-down is the lightest start.' }],
    });
  }

  recs.push({
    order: 7, id: 'rec-reflect', kind: 'reflect',
    title: 'Close the week with gratitude and planning',
    action: 'On Sunday, each person names one thing they appreciated and one thing for next week.',
    priority: 1,
    signals: ['Weekly rhythm'],
    pattern: 'Reflection turns a plan into a habit that can adapt.',
    why: 'A short weekly reflection lets the family adjust the plan instead of abandoning it.',
    whyAction: 'Appreciation first keeps the tone constructive.',
    control: 'The family decides what to keep, change or drop for next week.',
    minutes: 15,
    benefit: 'Keeps the plan realistic from week to week.',
    alternative: 'Write one gratitude note in the Memory Vault instead.',
    plan: [{ title: 'Gratitude reflection and next-week planning', day: 6, minutes: 15, who: ['all'], category: 'reflection', reason: 'A weekly reflection keeps the plan adaptable.' }],
  });

  return recs
    .sort((x, y) => y.priority - x.priority || x.order - y.order)
    .map(({ order: _order, ...r }) => r);
}

export function analyze(
  a: AssessmentAnswers,
  profile: HouseholdProfile | null,
  events: ScheduleEvent[] = [],
): AssessmentResult {
  const score = computeScore(a);
  const categories = categoryScores(a);
  const statusKey = statusKeyFor(score);
  return {
    score,
    status: statusFor(score),
    statusKey,
    summary: summarize(score, statusKey, categories),
    categories,
    deductions: deductionsFor(a),
    signals: buildSignals(a),
    strengths: buildStrengths(a, profile, events),
    recommendations: generateRecommendations(a, profile, events),
  };
}
