import type { ActivityType, DemoStep, EventCategory, GoalId, CoachScenario } from '@/types';

export const GOALS: { id: GoalId; label: string; hint: string }[] = [
  { id: 'communicate', label: 'Communicate more openly', hint: 'Make important conversations easier to start.' },
  { id: 'balance', label: 'Balance household responsibilities', hint: 'Share planning and chores more fairly.' },
  { id: 'exam', label: 'Support exam wellbeing', hint: 'Protect study time, sleep and breathing room.' },
  { id: 'care', label: 'Improve older-adult care consistency', hint: 'Keep routines and family calls steady.' },
  { id: 'rest', label: 'Protect rest and sleep', hint: 'Make recovery part of the week.' },
  { id: 'quality-time', label: 'Create more quality time', hint: 'Protect small windows for being together.' },
];

export const ACTIVITIES: { id: ActivityType; label: string }[] = [
  { id: 'walk', label: 'Walks and movement' },
  { id: 'meal', label: 'Shared meals' },
  { id: 'game', label: 'Board or card games' },
  { id: 'call', label: 'Family calls' },
  { id: 'reflection', label: 'Gratitude and reflection' },
  { id: 'creative', label: 'Creative activities' },
];

export const EVENT_CATEGORIES: EventCategory[] = [
  'Work',
  'School',
  'Study',
  'Household Tasks',
  'Family Time',
  'Rest',
  'Older Adult Care',
  'Health Routine',
];

export interface QuestionDef {
  id: 'familyTime' | 'stress' | 'communication' | 'tasks' | 'student' | 'elder' | 'routines' | 'sleep';
  prompt: string;
  help: string;
  options: { value: string; label: string; hint?: string }[];
}

export const QUESTIONS: QuestionDef[] = [
  {
    id: 'familyTime',
    prompt: 'How often did your family intentionally connect this week?',
    help: 'Think of meals, walks, calls or conversations where people were truly present.',
    options: [
      { value: 'fourPlus', label: 'Four or more times' },
      { value: 'twoThree', label: 'Two or three times' },
      { value: 'once', label: 'Once' },
      { value: 'none', label: 'Not at all this week' },
    ],
  },
  {
    id: 'stress',
    prompt: 'How would you describe overall household stress?',
    help: 'Choose the option that best matches the general feeling at home.',
    options: [
      { value: 'low', label: 'Low', hint: 'Mostly calm and manageable' },
      { value: 'moderate', label: 'Moderate', hint: 'Some busy or tense moments' },
      { value: 'high', label: 'High', hint: 'Frequent pressure' },
      { value: 'overwhelming', label: 'Overwhelming', hint: 'Hard to keep up' },
    ],
  },
  {
    id: 'communication',
    prompt: 'How comfortable do family members feel starting important conversations?',
    help: 'This is about starting a conversation, not about agreeing.',
    options: [
      { value: 'strong', label: 'Strong and open' },
      { value: 'comfortable', label: 'Generally comfortable' },
      { value: 'limited', label: 'Limited' },
      { value: 'veryDifficult', label: 'Very difficult' },
    ],
  },
  {
    id: 'tasks',
    prompt: 'How fairly are household responsibilities distributed?',
    help: 'Include planning, cooking, cleaning, care and errands.',
    options: [
      { value: 'fair', label: 'Fair' },
      { value: 'slightly', label: 'Slightly uneven' },
      { value: 'uneven', label: 'Uneven' },
      { value: 'concentrated', label: 'Highly concentrated on one person' },
    ],
  },
  {
    id: 'student',
    prompt: 'Is a student currently experiencing study pressure?',
    help: 'Think about assessments, deadlines and workload.',
    options: [
      { value: 'none', label: 'None or low' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'high', label: 'High' },
      { value: 'severe', label: 'Severe' },
    ],
  },
  {
    id: 'elder',
    prompt: 'Does an older family member need routine support?',
    help: 'For example reminders, appointments, movement or regular family contact.',
    options: [
      { value: 'none', label: 'No routine support is needed' },
      { value: 'yes', label: 'Yes, routine support is needed' },
    ],
  },
  {
    id: 'routines',
    prompt: 'Were important family routines missed this week?',
    help: 'If no older family member needs support, choose the closest answer; it will not lower your score.',
    options: [
      { value: 'none', label: 'None were missed' },
      { value: 'occasional', label: 'One was occasionally missed' },
      { value: 'repeated', label: 'Routines were repeatedly missed' },
    ],
  },
  {
    id: 'sleep',
    prompt: 'How balanced are sleep and recovery across the household?',
    help: 'Consider bedtimes, rest after busy days and time to unwind.',
    options: [
      { value: 'good', label: 'Good' },
      { value: 'inconsistent', label: 'Inconsistent' },
      { value: 'poor', label: 'Poor' },
    ],
  },
];

export const NAV_PRIMARY = [
  { to: '/', label: 'Overview' },
  { to: '/assessment', label: 'Assessment' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/coach', label: 'AI Coach' },
  { to: '/plan', label: 'Weekly Plan' },
  { to: '/trust', label: 'Trust & Safety' },
];

export const NAV_MODULES = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/results', label: 'Results', icon: 'results' },
  { to: '/coach', label: 'AI Coach', icon: 'coach' },
  { to: '/plan', label: 'Weekly Plan', icon: 'plan' },
  { to: '/schedule', label: 'Smart Schedule', icon: 'schedule' },
  { to: '/student', label: 'Student Support', icon: 'student' },
  { to: '/care', label: 'Older Adult Care', icon: 'care' },
  { to: '/memories', label: 'Memory Vault', icon: 'memories' },
  { to: '/trust', label: 'Trust & Safety', icon: 'trust' },
] as const;

export const COACH_SCENARIOS: CoachScenario[] = [
  { id: 'exam', label: 'My child is stressed about exams.', keywords: ['exam', 'test', 'study', 'studying', 'assessment', 'grades', 'homework'] },
  { id: 'time', label: 'We do not spend enough time together.', keywords: ['time together', 'quality time', 'family time', 'spend time', 'busy', 'together'] },
  { id: 'tasks', label: 'One person handles most household tasks.', keywords: ['chores', 'tasks', 'housework', 'household', 'cooking', 'cleaning', 'fair'] },
  { id: 'care', label: 'We missed grandmother’s routine reminder.', keywords: ['grandmother', 'grandma', 'grandfather', 'reminder', 'medication', 'medicine', 'older', 'elderly'] },
  { id: 'conversation', label: 'Important conversations become arguments.', keywords: ['argue', 'argument', 'fight', 'shout', 'conversation', 'talk'] },
  { id: 'disconnected', label: 'A family member feels disconnected.', keywords: ['disconnected', 'lonely', 'withdrawn', 'distant', 'isolated', 'quiet'] },
  { id: 'overload', label: 'Our weekly schedule is overloaded.', keywords: ['schedule', 'overloaded', 'overwhelmed', 'too much', 'calendar', 'packed'] },
];

export const DEMO_STEPS: DemoStep[] = [
  { id: 'meet', title: 'Meet the Al Noor Family', short: 'Meet the family', notes: 'Five people, three generations, one UAE household. Everything here is fictional demo data stored only in this browser.' },
  { id: 'signals', title: 'Discover the connected signals', short: 'Connect signals', notes: 'Each signal alone looks small. Connected, they show one pattern: Wednesday is overloaded, and exams are close.' },
  { id: 'assessment', title: 'Complete the family assessment', short: 'Assessment', notes: 'Eight questions, a transparent deduction table, no black box. The demo answers always produce the same result.' },
  { id: 'recommend', title: 'Understand the recommendation', short: 'Recommendation', notes: 'Every recommendation shows signal, reason, who controls it and how long it takes.' },
  { id: 'plan', title: 'Generate the weekly plan', short: 'Weekly plan', notes: 'At most two wellbeing actions a day, each with a reason. Editable, replaceable, and printable.' },
  { id: 'optimize', title: 'Optimize the schedule', short: 'Optimize', notes: 'The optimizer proposes. The family decides. Nothing changes until changes are confirmed, and Undo is always available.' },
  { id: 'trust', title: 'Review privacy and explainability', short: 'Trust', notes: 'Private notes stay private. Households see consented summaries only. Boundaries are stated plainly.' },
  { id: 'final', title: 'Show the final family actions', short: 'Outcome', notes: 'Close on the family’s control: see, decide, and act together.' },
];
