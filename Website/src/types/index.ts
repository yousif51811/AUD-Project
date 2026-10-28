/** Centralized domain types for FamilyMind AI. */

export type AgeGroup = 'child' | 'teen' | 'adult' | 'older';
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday … 6 = Sunday
export type MemberColor = 'blue' | 'gold' | 'teal' | 'violet' | 'red';

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  age?: number;
  ageGroup: AgeGroup;
  color: MemberColor;
  /** Abstract profile icon key (see components/shared/MemberAvatar) */
  icon: 'orbit' | 'leaf' | 'spark' | 'wave' | 'star';
  accessibility: string[];
  sharesSummaries: boolean;
  grade?: string;
}

export type GoalId =
  | 'communicate'
  | 'balance'
  | 'exam'
  | 'care'
  | 'rest'
  | 'quality-time';

export type ActivityType = 'walk' | 'meal' | 'game' | 'call' | 'reflection' | 'creative';

export interface SharedWindow {
  day: DayIndex;
  start: string; // HH:MM
  end: string;
}

export interface ConsentPreference {
  /** What the household may see as a summary. Private notes are never in this list. */
  fields: Record<'mood' | 'workload' | 'sleep' | 'careStatus' | 'schedule', boolean>;
  allowBackupNotification: boolean;
}

export interface Preferences {
  reminders: 'gentle' | 'standard' | 'minimal';
  activities: ActivityType[];
  windows: SharedWindow[];
  maxDailyMinutes: number;
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

export interface HouseholdProfile {
  id: string;
  name: string;
  members: FamilyMember[];
  goals: GoalId[];
  consent: ConsentPreference;
  preferences: Preferences;
  isDemo: boolean;
}

/* ---------- Assessment ---------- */

export type FamilyTimeAnswer = 'fourPlus' | 'twoThree' | 'once' | 'none';
export type StressAnswer = 'low' | 'moderate' | 'high' | 'overwhelming';
export type CommunicationAnswer = 'strong' | 'comfortable' | 'limited' | 'veryDifficult';
export type TaskAnswer = 'fair' | 'slightly' | 'uneven' | 'concentrated';
export type StudentAnswer = 'none' | 'moderate' | 'high' | 'severe';
export type ElderAnswer = 'none' | 'yes';
export type RoutineAnswer = 'none' | 'occasional' | 'repeated';
export type SleepAnswer = 'good' | 'inconsistent' | 'poor';

export interface AssessmentAnswers {
  familyTime: FamilyTimeAnswer;
  stress: StressAnswer;
  communication: CommunicationAnswer;
  tasks: TaskAnswer;
  student: StudentAnswer;
  elder: ElderAnswer;
  routines: RoutineAnswer;
  sleep: SleepAnswer;
  goals: GoalId[];
  note: string;
}

export type PartialAnswers = Partial<Omit<AssessmentAnswers, 'goals' | 'note'>> & {
  goals?: GoalId[];
  note?: string;
};

export type CategoryId =
  | 'connection'
  | 'balance'
  | 'student'
  | 'care'
  | 'rest';

export type StatusKey = 'strong' | 'stable' | 'attention' | 'priority';

export interface Deduction {
  key: string;
  question: string;
  answerLabel: string;
  points: number;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;
  applicable: boolean;
  statusLabel: string;
  deducted: number;
  max: number;
  description: string;
}

export interface FamilySignal {
  id: string;
  label: string;
  detail: string;
  category: CategoryId;
  severity: 'watch' | 'attention';
}

export interface FamilyStrength {
  id: string;
  label: string;
  detail: string;
}

export interface PlanActionTemplate {
  title: string;
  day: DayIndex;
  minutes: number;
  /** Role tokens resolved against the household: student, youngStudent, elder, adults, helper, carrier, all */
  who: string[];
  reason: string;
  category: PlanCategory;
}

export type PlanCategory = 'connection' | 'balance' | 'study' | 'care' | 'rest' | 'reflection';

export interface Recommendation {
  id: string;
  kind: 'study' | 'checkin' | 'care' | 'balance' | 'window' | 'rest' | 'reflect';
  title: string;
  action: string;
  priority: number;
  signals: string[];
  pattern: string;
  why: string;
  whyAction: string;
  control: string;
  minutes: number;
  benefit: string;
  alternative: string;
  plan: PlanActionTemplate[];
}

export interface AssessmentResult {
  score: number;
  status: string;
  statusKey: StatusKey;
  summary: string;
  categories: CategoryScore[];
  deductions: Deduction[];
  signals: FamilySignal[];
  strengths: FamilyStrength[];
  recommendations: Recommendation[];
}

export interface AssessmentRecord {
  answers: AssessmentAnswers;
  completed: boolean;
  /** 'demo' when produced by the Al Noor preset */
  source: 'demo' | 'user';
}

/* ---------- Schedule ---------- */

export type EventCategory =
  | 'Work'
  | 'School'
  | 'Study'
  | 'Household Tasks'
  | 'Family Time'
  | 'Rest'
  | 'Older Adult Care'
  | 'Health Routine';

export interface ScheduleEvent {
  date?: string; // YYYY-MM-DD in household timezone; legacy imports map explicitly.
  id: string;
  title: string;
  day: DayIndex;
  start: string;
  end: string;
  category: EventCategory;
  assigneeIds: string[];
  backupId?: string;
  done: boolean;
  /** Non-urgent tasks can be moved by the optimizer (with confirmation) */
  flexible?: boolean;
  /** Assessment or exam, used for countdowns */
  exam?: boolean;
  protected?: boolean;
  careReminder?: boolean;
  notes?: string;
}

export type ScheduleChange =
  | { op: 'update'; eventId: string; patch: Partial<ScheduleEvent> }
  | { op: 'add'; event: ScheduleEvent };

export type ProposalKind =
  | 'reassign'
  | 'share'
  | 'protect-study'
  | 'recovery'
  | 'care-backup'
  | 'connect'
  | 'family-time';

export interface OptimizationProposal {
  id: string;
  kind: ProposalKind;
  title: string;
  detail: string;
  why: string;
  signal: string;
  changes: ScheduleChange[];
}

/* ---------- Plan ---------- */

export interface PlanAction {
  id: string;
  day: DayIndex;
  title: string;
  reason: string;
  participantIds: string[];
  minutes: number;
  done: boolean;
  category: PlanCategory;
  recId?: string;
  source: 'engine' | 'coach' | 'user';
}

export interface WeeklyPlan {
  actions: PlanAction[];
  /** Actions hidden by Reduce Workload mode; restored when it is turned off. */
  parked: PlanAction[];
  reduced: boolean;
  isSample: boolean;
}

/* ---------- Coach ---------- */

export type CoachScenarioId =
  | 'exam'
  | 'time'
  | 'tasks'
  | 'care'
  | 'conversation'
  | 'disconnected'
  | 'overload'
  | 'general';

export interface CoachScenario {
  id: CoachScenarioId;
  label: string;
  keywords: string[];
}

export interface CoachResponse {
  scenario: CoachScenarioId;
  kind: 'coaching' | 'safety';
  reflection: string;
  pattern: string;
  todayAction: { title: string; minutes: number };
  weekSteps: string[];
  conversationStarter: string;
  why: string;
  safetyNote?: string;
  plan: PlanActionTemplate[];
  source: 'deterministic' | 'remote';
}

/* ---------- Care / Student / Memories ---------- */

export type CareKind = 'medication' | 'hydration' | 'movement' | 'call' | 'appointment' | 'story';
export type ReminderStatus = 'pending' | 'confirmed' | 'later' | 'asked' | 'missed';

export interface Reminder {
  id: string;
  kind: CareKind;
  title: string;
  time: string;
  detail: string;
  status: ReminderStatus;
  /** Whether a backup may be notified if this reminder is missed */
  required: boolean;
  backupId?: string;
  backupAgreed: boolean;
  askedId?: string;
  log: string[];
}

export interface CareState {
  reminders: Reminder[];
  emergencyContact: { name: string; relationship: string; note: string } | null;
}

export interface StudentState {
  goal: string;
  bedtime: string;
  wake: string;
  sleepLog: number[]; // hours slept for last 7 nights
  shares: Record<'workload' | 'exams' | 'support' | 'sleep', boolean>;
  supportRequest: string;
}

export type MemoryType =
  | 'Gratitude'
  | 'Achievement'
  | 'Kind Message'
  | 'Family Tradition'
  | 'Weekly Win'
  | 'Story'
  | 'Photo Memory Description';

export type MemoryVisibility = 'Only me' | 'Selected members' | 'Household';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  message: string;
  date: string; // YYYY-MM-DD
  tagIds: string[];
  visibility: MemoryVisibility;
}

/* ---------- Demo ---------- */

export interface DemoStep {
  id: string;
  title: string;
  short: string;
  notes: string;
}
