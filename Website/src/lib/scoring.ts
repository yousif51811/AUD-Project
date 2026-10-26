import type {
  AssessmentAnswers,
  CategoryScore,
  Deduction,
  PartialAnswers,
  StatusKey,
} from '@/types';

/** Deterministic prototype scoring. Start at 100, subtract the listed deductions, clamp 0–100. */
export const DEDUCTION_TABLE = {
  stress: { low: 0, moderate: 8, high: 18, overwhelming: 28 },
  communication: { strong: 0, comfortable: 6, limited: 14, veryDifficult: 22 },
  familyTime: { fourPlus: 0, twoThree: 5, once: 11, none: 18 },
  tasks: { fair: 0, slightly: 6, uneven: 13, concentrated: 20 },
  student: { none: 0, moderate: 5, high: 12, severe: 18 },
  care: { none: 0, occasional: 7, repeated: 15 },
  sleep: { good: 0, inconsistent: 5, poor: 12 },
} as const;

export const ANSWER_LABELS = {
  familyTime: { fourPlus: 'Four or more times', twoThree: 'Two or three times', once: 'Once', none: 'Not this week' },
  stress: { low: 'Low', moderate: 'Moderate', high: 'High', overwhelming: 'Overwhelming' },
  communication: {
    strong: 'Strong and open',
    comfortable: 'Generally comfortable',
    limited: 'Limited',
    veryDifficult: 'Very difficult',
  },
  tasks: { fair: 'Fair', slightly: 'Slightly uneven', uneven: 'Uneven', concentrated: 'Highly concentrated' },
  student: { none: 'None or low', moderate: 'Moderate', high: 'High', severe: 'Severe' },
  elder: { none: 'No routine support needed', yes: 'Yes, routine support is needed' },
  routines: { none: 'None missed', occasional: 'Occasionally missed', repeated: 'Repeatedly missed' },
  sleep: { good: 'Good', inconsistent: 'Inconsistent', poor: 'Poor' },
} as const;

export const STATUS_LABELS: Record<StatusKey, string> = {
  strong: 'Strong Foundation',
  stable: 'Stable with Opportunities',
  attention: 'Needs Attention',
  priority: 'Priority Support',
};

export function statusKeyFor(score: number): StatusKey {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'stable';
  if (score >= 40) return 'attention';
  return 'priority';
}

export function statusFor(score: number): string {
  return STATUS_LABELS[statusKeyFor(score)];
}

export function careDeduction(a: Pick<AssessmentAnswers, 'elder' | 'routines'>): number {
  if (a.elder === 'none') return 0;
  return DEDUCTION_TABLE.care[a.routines];
}

export function isComplete(a: PartialAnswers): a is AssessmentAnswers {
  return !!(a.familyTime && a.stress && a.communication && a.tasks && a.student && a.elder && a.routines && a.sleep);
}

export function computeScore(a: AssessmentAnswers): number {
  const total =
    DEDUCTION_TABLE.stress[a.stress] +
    DEDUCTION_TABLE.communication[a.communication] +
    DEDUCTION_TABLE.familyTime[a.familyTime] +
    DEDUCTION_TABLE.tasks[a.tasks] +
    DEDUCTION_TABLE.student[a.student] +
    careDeduction(a) +
    DEDUCTION_TABLE.sleep[a.sleep];
  return Math.round(Math.max(0, Math.min(100, 100 - total)));
}

export function deductionsFor(a: AssessmentAnswers): Deduction[] {
  return [
    { key: 'stress', question: 'Household stress', answerLabel: ANSWER_LABELS.stress[a.stress], points: DEDUCTION_TABLE.stress[a.stress] },
    { key: 'communication', question: 'Conversation comfort', answerLabel: ANSWER_LABELS.communication[a.communication], points: DEDUCTION_TABLE.communication[a.communication] },
    { key: 'familyTime', question: 'Intentional family time', answerLabel: ANSWER_LABELS.familyTime[a.familyTime], points: DEDUCTION_TABLE.familyTime[a.familyTime] },
    { key: 'tasks', question: 'Task distribution', answerLabel: ANSWER_LABELS.tasks[a.tasks], points: DEDUCTION_TABLE.tasks[a.tasks] },
    { key: 'student', question: 'Student pressure', answerLabel: ANSWER_LABELS.student[a.student], points: DEDUCTION_TABLE.student[a.student] },
    {
      key: 'care',
      question: 'Care continuity',
      answerLabel: a.elder === 'none' ? 'No routine support needed' : ANSWER_LABELS.routines[a.routines],
      points: careDeduction(a),
    },
    { key: 'sleep', question: 'Rest and sleep', answerLabel: ANSWER_LABELS.sleep[a.sleep], points: DEDUCTION_TABLE.sleep[a.sleep] },
  ];
}

function categoryLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Steady';
  if (score >= 40) return 'Needs attention';
  return 'Priority';
}

function mk(
  id: CategoryScore['id'],
  label: string,
  deducted: number,
  max: number,
  description: string,
  applicable = true,
): CategoryScore {
  const score = applicable ? Math.round(100 * (1 - deducted / max)) : 100;
  return {
    id,
    label,
    score,
    applicable,
    statusLabel: applicable ? categoryLabel(score) : 'Not needed this week',
    deducted: applicable ? deducted : 0,
    max,
    description,
  };
}

/** Category scores use only the deductions that relate to each category. */
export function categoryScores(a: AssessmentAnswers): CategoryScore[] {
  const d = DEDUCTION_TABLE;
  return [
    mk('connection', 'Connection', d.communication[a.communication] + d.familyTime[a.familyTime], 22 + 18,
      'Based on conversation comfort and intentional family time.'),
    mk('balance', 'Responsibility Balance', d.tasks[a.tasks], 20,
      'Based on how evenly household responsibilities are shared.'),
    mk('student', 'Student Support', d.student[a.student], 18,
      'Based on reported study pressure.'),
    mk('care', 'Care Continuity', careDeduction(a), 15,
      'Based on whether important routines were missed for an older family member.', a.elder !== 'none'),
    mk('rest', 'Rest and Recovery', d.sleep[a.sleep] + d.stress[a.stress], 12 + 28,
      'Based on sleep balance and overall household stress.'),
  ];
}

export function summarize(_score: number, statusKey: StatusKey, categories: CategoryScore[]): string {
  const lowest = [...categories].filter((c) => c.applicable).sort((x, y) => x.score - y.score)[0];
  const lead: Record<StatusKey, string> = {
    strong: 'Your household reports a strong foundation this week.',
    stable: 'Your household is stable, with a few clear opportunities.',
    attention: 'Several reported signals overlap this week, so a small coordinated plan will help.',
    priority: 'Several reported signals need support this week. Start with one small step together.',
  };
  const focus = lowest && lowest.score < 80 ? ` ${lowest.label} is the area to look at first.` : '';
  return `${lead[statusKey]}${focus} This score is a prioritization aid, not a medical result or a judgment about your family.`;
}
