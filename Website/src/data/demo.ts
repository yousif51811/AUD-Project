import type {
  AssessmentAnswers,
  CareState,
  ConsentPreference,
  DayIndex,
  EventCategory,
  FamilyMember,
  GoalId,
  HouseholdProfile,
  MemoryEntry,
  Preferences,
  ScheduleEvent,
  StudentState,
} from '@/types';

export const DEMO_MEMBERS: FamilyMember[] = [
  { id: 'omar', name: 'Omar', role: 'Father', age: 44, ageGroup: 'adult', color: 'blue', icon: 'orbit', accessibility: [], sharesSummaries: true },
  { id: 'mariam', name: 'Mariam', role: 'Mother', age: 41, ageGroup: 'adult', color: 'teal', icon: 'leaf', accessibility: [], sharesSummaries: true },
  { id: 'zayed', name: 'Zayed', role: 'Student', age: 16, ageGroup: 'teen', color: 'violet', icon: 'spark', accessibility: [], sharesSummaries: true, grade: 'Grade 11' },
  { id: 'latifa', name: 'Latifa', role: 'Student', age: 12, ageGroup: 'child', color: 'gold', icon: 'star', accessibility: [], sharesSummaries: true, grade: 'Grade 7' },
  { id: 'fatima', name: 'Fatima', role: 'Grandmother', age: 70, ageGroup: 'older', color: 'red', icon: 'wave', accessibility: ['Large text'], sharesSummaries: false },
];

export const DEFAULT_CONSENT: ConsentPreference = {
  fields: { mood: true, workload: true, sleep: false, careStatus: true, schedule: true },
  allowBackupNotification: true,
};

export const DEFAULT_PREFERENCES: Preferences = {
  reminders: 'gentle',
  activities: ['walk', 'meal', 'call', 'reflection'],
  windows: [{ day: 4, start: '18:00', end: '20:00' }],
  maxDailyMinutes: 90,
  largeText: false,
  highContrast: false,
  reduceMotion: false,
};

export function demoProfile(): HouseholdProfile {
  return {
    id: 'al-noor',
    name: 'Al Noor Family',
    members: DEMO_MEMBERS.map((m) => ({ ...m, accessibility: [...m.accessibility] })),
    goals: ['communicate', 'care'],
    consent: { fields: { ...DEFAULT_CONSENT.fields }, allowBackupNotification: true },
    preferences: { ...DEFAULT_PREFERENCES, windows: DEFAULT_PREFERENCES.windows.map((w) => ({ ...w })), activities: [...DEFAULT_PREFERENCES.activities] },
    isDemo: true,
  };
}

/**
 * Al Noor deterministic answers.
 * Mapping note: with the fixed deduction table these answers total 55 points,
 * producing a score of 45 — "Needs Attention".
 */
export const DEMO_ANSWERS: AssessmentAnswers = {
  familyTime: 'once',
  stress: 'moderate',
  communication: 'comfortable',
  tasks: 'slightly',
  student: 'high',
  elder: 'yes',
  routines: 'occasional',
  sleep: 'inconsistent',
  goals: ['communicate', 'care'] as GoalId[],
  note: 'A calmer Wednesday, and one dinner where nobody looks at a screen.',
};

/* ---------- Schedule ---------- */

let seq = 0;
function ev(
  title: string,
  day: DayIndex,
  start: string,
  end: string,
  category: EventCategory,
  assigneeIds: string[],
  extra: Partial<ScheduleEvent> = {},
): ScheduleEvent {
  seq += 1;
  return { id: `ev-${String(seq).padStart(3, '0')}`, title, day, start, end, category, assigneeIds, done: false, ...extra };
}

export function demoSchedule(): ScheduleEvent[] {
  seq = 0;
  const out: ScheduleEvent[] = [];
  for (const d of [0, 1, 2, 3, 4] as DayIndex[]) {
    out.push(ev('Work', d, '08:00', '16:30', 'Work', ['omar']));
    out.push(ev('Work', d, '08:00', '16:00', 'Work', ['mariam']));
    out.push(ev('School', d, '07:30', '14:00', 'School', ['latifa']));
    if (d === 3) {
      out.push(ev('School', d, '07:30', '09:00', 'School', ['zayed']));
      out.push(ev('Physics assessment', d, '09:00', '10:30', 'School', ['zayed'], { exam: true }));
      out.push(ev('School', d, '10:30', '14:30', 'School', ['zayed']));
    } else if (d === 4) {
      out.push(ev('School', d, '07:30', '09:00', 'School', ['zayed']));
      out.push(ev('Mathematics assessment', d, '09:00', '10:30', 'School', ['zayed'], { exam: true }));
      out.push(ev('School', d, '10:30', '14:30', 'School', ['zayed']));
    } else {
      out.push(ev('School', d, '07:30', '14:30', 'School', ['zayed']));
    }
  }
  out.push(ev('Study: Mathematics revision', 0, '17:00', '18:30', 'Study', ['zayed']));
  out.push(ev('Study: Physics notes', 1, '17:00', '18:00', 'Study', ['zayed']));
  out.push(ev('Basketball club', 2, '16:00', '17:30', 'Health Routine', ['zayed']));
  out.push(ev('Study: Physics revision', 2, '17:00', '18:00', 'Study', ['zayed']));
  for (const d of [0, 1, 2, 3] as DayIndex[]) out.push(ev('Homework', d, '16:30', '17:30', 'Study', ['latifa']));

  out.push(ev('Take out the recycling', 0, '19:00', '19:15', 'Household Tasks', ['zayed'], { flexible: true }));
  out.push(ev('Meal prep', 0, '17:30', '18:10', 'Household Tasks', ['mariam']));
  out.push(ev('Meal prep', 3, '17:30', '18:10', 'Household Tasks', ['mariam']));
  out.push(ev('Weekly grocery planning', 1, '20:15', '21:00', 'Household Tasks', ['mariam'], { flexible: true }));
  out.push(ev('Set the table', 1, '19:00', '19:10', 'Household Tasks', ['latifa']));
  out.push(ev('Set the table', 3, '19:00', '19:10', 'Household Tasks', ['latifa']));
  out.push(ev('Kitchen cleanup after dinner', 2, '19:30', '20:15', 'Household Tasks', ['zayed'], { flexible: true }));
  out.push(ev('Laundry', 5, '10:00', '11:00', 'Household Tasks', ['mariam']));
  out.push(ev('Car wash', 5, '11:00', '11:30', 'Household Tasks', ['omar']));
  out.push(ev('Tidy bedroom', 5, '11:00', '11:30', 'Household Tasks', ['zayed'], { flexible: true }));

  for (const d of [0, 1, 2, 3, 4, 5, 6] as DayIndex[]) {
    out.push(ev('Fatima: evening medication reminder', d, '21:15', '21:25', 'Older Adult Care', ['mariam'], { careReminder: true }));
  }
  out.push(ev('Fatima: clinic check-up (accompany)', 3, '16:30', '17:30', 'Older Adult Care', ['mariam']));
  for (const d of [0, 2, 4] as DayIndex[]) out.push(ev('Gentle morning walk', d, '07:30', '08:00', 'Health Routine', ['fatima']));
  out.push(ev('Family dinner', 6, '19:00', '20:00', 'Family Time', ['omar', 'mariam', 'zayed', 'latifa', 'fatima']));
  return out;
}

/* ---------- Care ---------- */

export function demoCare(): CareState {
  return {
    emergencyContact: null,
    reminders: [
      { id: 'care-med', kind: 'medication', title: 'Morning medication', time: '08:00', detail: 'Take the morning medication as set by Fatima’s clinic.', status: 'missed', required: true, backupAgreed: false, log: ['08:00 — Primary reminder sent to Fatima.', '08:30 — Not yet confirmed.'] },
      { id: 'care-water', kind: 'hydration', title: 'Water with lunch', time: '12:30', detail: 'A glass of water with lunch.', status: 'pending', required: false, backupAgreed: false, log: [] },
      { id: 'care-move', kind: 'movement', title: 'Gentle walk or stretching', time: '17:30', detail: 'Ten minutes in the garden or indoors, at a comfortable pace.', status: 'pending', required: false, backupAgreed: false, log: [] },
      { id: 'care-call', kind: 'call', title: 'Evening call with Latifa', time: '18:30', detail: 'A short call to hear about Latifa’s science presentation.', status: 'pending', required: false, backupAgreed: false, log: [] },
      { id: 'care-appt', kind: 'appointment', title: 'Clinic check-up, Thursday 4:30 PM', time: '16:30', detail: 'Mariam will accompany Fatima. Bring the medication list.', status: 'pending', required: false, backupAgreed: false, log: [] },
      { id: 'care-story', kind: 'story', title: 'Story prompt: a childhood place', time: '19:00', detail: 'Tell the family about a place you loved when you were young.', status: 'pending', required: false, backupAgreed: false, log: [] },
    ],
  };
}

/* ---------- Student ---------- */

export function demoStudent(): StudentState {
  return {
    goal: 'Finish Physics past paper, section B (45 minutes)',
    bedtime: '22:30',
    wake: '06:30',
    sleepLog: [7.5, 6, 7, 5.5, 6.5, 6, 6.5],
    shares: { workload: true, exams: true, support: false, sleep: false },
    supportRequest: '',
  };
}

/* ---------- Memories ---------- */

export function demoMemories(): MemoryEntry[] {
  return [
    { id: 'mem-1', type: 'Achievement', title: 'Latifa’s science presentation', message: 'Latifa completed her science presentation and explained the water cycle without notes. The whole family cheered at dinner.', date: '2025-11-03', tagIds: ['latifa'], visibility: 'Household' },
    { id: 'mem-2', type: 'Story', title: 'Grandmother’s childhood story', message: 'Fatima shared a story about walking to the date market with her sisters before sunrise. Zayed asked three questions and wrote it down.', date: '2025-11-01', tagIds: ['fatima', 'zayed'], visibility: 'Household' },
    { id: 'mem-3', type: 'Weekly Win', title: 'Omar protected Friday family time', message: 'Omar moved a late call so the family could walk together on Friday evening.', date: '2025-10-31', tagIds: ['omar'], visibility: 'Household' },
    { id: 'mem-4', type: 'Gratitude', title: 'Mariam asked for support', message: 'Mariam asked for help and two responsibilities were shared. Thank you for saying it out loud.', date: '2025-10-29', tagIds: ['mariam', 'omar'], visibility: 'Selected members' },
  ];
}

/* ---------- Dashboard illustrative data ---------- */

export const MOOD_TREND = {
  label: 'Shared household mood index (0–100)',
  points: [
    { day: 'Wed', value: 64 },
    { day: 'Thu', value: 61 },
    { day: 'Fri', value: 63 },
    { day: 'Sat', value: 57 },
    { day: 'Sun', value: 52 },
    { day: 'Mon', value: 54 },
    { day: 'Tue', value: 50 },
  ],
};

export const PROBLEM_SIGNALS = [
  { id: 'time', label: 'Four days without shared time', category: 'Connection' },
  { id: 'exam', label: 'Exam load rising this week', category: 'Student' },
  { id: 'care', label: 'One care reminder missed', category: 'Care' },
  { id: 'tasks', label: 'Most household planning assigned to one person', category: 'Balance' },
  { id: 'sleep', label: 'Sleep routine inconsistent', category: 'Rest' },
];
