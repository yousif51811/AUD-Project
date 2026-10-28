import { useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import type {
  AssessmentRecord,
  AssessmentResult,
  CareState,
  DayIndex,
  HouseholdProfile,
  MemoryEntry,
  OptimizationProposal,
  PartialAnswers,
  PlanAction,
  PlanActionTemplate,
  Reminder,
  ScheduleEvent,
  StudentState,
  WeeklyPlan,
} from '@/types';
import { DEMO_ANSWERS, demoCare, demoMemories, demoProfile, demoSchedule, demoStudent } from '@/data/demo';
import { analyze } from '@/lib/recommendations';
import { addActionsToPlan, generatePlan } from '@/lib/plan';
import { applyProposals as applyOpt } from '@/lib/scheduleOptimizer';
import { todayIndex, toMin } from '@/lib/time';
import { KEYS, isArray, isObject, load, save, remove, storageAvailable, type KVStore } from '@/lib/storage';
import { isComplete } from '@/lib/scoring';
import { appendQuickAction } from '@/lib/actions';
import { AppContext as Ctx } from './appContext';
import { useDisplay } from '@/lib/display';
import { useWorkspace } from '@/workspace/Workspace';
import { hydrateState, splitState } from '@/workspace/records';
import { dateForDay, householdDate } from '@/lib/dates';
import { proposalCalendar } from '@/workspace/proposals';
import { canonical } from '@/lib/canonical';
import { uid } from '@/lib/sanitize';

export interface AppState {
  profile: HouseholdProfile | null;
  assessment: AssessmentRecord | null;
  draft: PartialAnswers;
  plan: WeeklyPlan | null;
  schedule: ScheduleEvent[];
  memories: MemoryEntry[];
  care: CareState;
  student: StudentState;
}

const EMPTY_CARE: CareState = { reminders: [], emergencyContact: null };
const EMPTY_STUDENT: StudentState = {
  goal: '',
  bedtime: '22:30',
  wake: '06:30',
  sleepLog: [],
  shares: { workload: false, exams: false, support: false, sleep: false },
  supportRequest: '',
};

const validProfile = (x: unknown): x is HouseholdProfile => isObject(x) && isArray(x.members) && isObject(x.preferences) && isObject(x.consent);
const validAssessment = (x: unknown): x is AssessmentRecord => isObject(x) && isObject(x.answers) && isComplete(x.answers as PartialAnswers);
const validPlan = (x: unknown): x is WeeklyPlan => isObject(x) && isArray(x.actions) && isArray(x.parked);
const validEvents = (x: unknown): x is ScheduleEvent[] => isArray(x) && x.every((e) => isObject(e) && typeof e.id === 'string');
const validMemories = (x: unknown): x is MemoryEntry[] => isArray(x) && x.every((e) => isObject(e) && typeof e.id === 'string');
const validCare = (x: unknown): x is CareState => isObject(x) && isArray(x.reminders);
const validStudent = (x: unknown): x is StudentState => isObject(x) && isArray(x.sleepLog) && isObject(x.shares);
const validDraft = (x: unknown): x is PartialAnswers => isObject(x);

export function demoState(): AppState {
  const profile = demoProfile();
  const schedule = demoSchedule();
  return {
    profile,
    assessment: { answers: { ...DEMO_ANSWERS, goals: [...DEMO_ANSWERS.goals] }, completed: true, source: 'demo' },
    draft: {},
    plan: generatePlan(DEMO_ANSWERS, profile, schedule, { isSample: true }),
    schedule,
    memories: demoMemories(),
    care: demoCare(),
    student: demoStudent(),
  };
}

export function emptyState(): AppState {
  return { profile: null, assessment: null, draft: {}, plan: null, schedule: [], memories: [], care: EMPTY_CARE, student: EMPTY_STUDENT };
}

export function initialState(store?: KVStore): AppState {
  const profile = load(KEYS.profile, validProfile, store);
  const seeded = load(KEYS.seeded, isObject, store) !== null;
  if (!profile && !seeded) {
    return demoState();
  }
  return {
    profile,
    assessment: load(KEYS.assessment, validAssessment, store),
    draft: load(KEYS.draft, validDraft, store) ?? {},
    plan: load(KEYS.plan, validPlan, store),
    schedule: load(KEYS.schedule, validEvents, store) ?? [],
    memories: load(KEYS.memories, validMemories, store) ?? [],
    care: load(KEYS.care, validCare, store) ?? EMPTY_CARE,
    student: load(KEYS.student, validStudent, store) ?? EMPTY_STUDENT,
  };
}

/** Persist nullable slices too, so clearing memory cannot resurrect saved demo data. */
export function persistState(state: AppState, store?: KVStore): void {
  for (const name of ['profile', 'assessment', 'plan', 'draft', 'schedule', 'memories', 'care', 'student'] as const) {
    if (state[name] === null) remove(KEYS[name], store);
    else save(KEYS[name], state[name], store);
  }
  save(KEYS.seeded, { seeded: true }, store);
}

export function completeHousehold(state: AppState, profile: HouseholdProfile): AppState {
  return state.profile?.isDemo && !profile.isDemo ? { ...emptyState(), profile } : { ...state, profile };
}

export type ScheduleSnapshot = Pick<AppState, 'schedule' | 'care'>;
export function applyScheduleChanges(state: AppState, proposals: OptimizationProposal[]): AppState {
  const schedule = applyOpt(state.schedule, proposals);
  return { ...state, schedule, care: syncCare(state.care, schedule) };
}
export function restoreSchedule(state: AppState, previous: ScheduleSnapshot): AppState {
  return { ...state, ...previous };
}

/** Keep care reminders in step with backups assigned through the schedule. */
function syncCare(care: CareState, events: ScheduleEvent[]): CareState {
  const withBackup = events.find((e) => e.careReminder && e.backupId);
  if (!withBackup) return care;
  return {
    ...care,
    reminders: care.reminders.map((r) =>
      r.kind === 'medication' && !r.backupId
        ? { ...r, backupId: withBackup.backupId, log: [...r.log, 'Backup person assigned from the schedule. Notifications start only after everyone agrees.'] }
        : r,
    ),
  };
}

export interface AppApi extends AppState {
  result: AssessmentResult | null;
  today: DayIndex;
  canUndoSchedule: boolean;
  storageOk: boolean;
  restoreDemo: () => void;
  clearData: () => void;
  completeOnboarding: (p: HouseholdProfile) => void;
  updateProfile: (fn: (p: HouseholdProfile) => HouseholdProfile) => void;
  setDraft: (d: PartialAnswers) => void;
  submitAssessment: (rec: AssessmentRecord) => void;
  regeneratePlan: () => void;
  updatePlan: (fn: (p: WeeklyPlan) => WeeklyPlan) => void;
  toggleAction: (id: string) => void;
  editAction: (id: string, patch: Partial<PlanAction>) => void;
  deleteAction: (id: string) => void;
  addCoachActions: (t: PlanActionTemplate[]) => { added: number; skipped: number };
  addQuickAction: (a: PlanAction) => string[];
  addQuickActions: (a: PlanAction[]) => string[];
  addEvent: (e: Omit<ScheduleEvent, 'id' | 'done'>) => void;
  updateEvent: (id: string, patch: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;
  applyProposals: (p: OptimizationProposal[]) => void;
  undoSchedule: () => void;
  addMemory: (m: Omit<MemoryEntry, 'id'>) => void;
  updateMemory: (id: string, patch: Partial<MemoryEntry>) => void;
  deleteMemory: (id: string) => void;
  updateReminder: (id: string, fn: (r: Reminder) => Reminder) => void;
  setCare: (fn: (c: CareState) => CareState) => void;
  updateStudent: (fn: (s: StudentState) => StudentState) => void;
}



export function AppProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const [display]=useDisplay(workspace.actorId);
  const [state, setState] = useState<AppState>(() => demoState());
  const lastPersisted = useRef('');
  const syncing = useRef(false);
  const baseline = useRef<AppState>(state);
  const epoch = useRef(0);
  const [undo, setUndo] = useState<ScheduleSnapshot[]>([]);
  const storageOk = useMemo(() => storageAvailable(), []);

  useEffect(() => {
    epoch.current++; syncing.current=false;
    let next=emptyState();
    if(workspace.mode==='demo'){
      try { const saved=sessionStorage.getItem('familymind:demo:v2');next=saved?JSON.parse(saved):demoState(); }catch{next=demoState();}
    }
    baseline.current=next;lastPersisted.current=canonical(next);setUndo([]);setState(next);
  }, [workspace.generation,workspace.mode]);
  useEffect(()=>{
    if(workspace.mode!=='account'||!workspace.identity||!workspace.family||syncing.current)return;
    try{const next=hydrateState(workspace.records,emptyState());baseline.current=next;lastPersisted.current=canonical(next);setState(next);}
    catch(e){workspace.setError((e as Error).message);}
  },[workspace.records,workspace.identity,workspace.family,workspace.mode]);
  useEffect(()=>{
    if(workspace.mode==='demo'){try{sessionStorage.setItem('familymind:demo:v2',JSON.stringify(state));}catch{/* ephemeral demo */}return;}
    if(!workspace.identity||!workspace.family||!state.profile||canonical(state)===lastPersisted.current)return;
    const captured=epoch.current;
    const timer=setTimeout(()=>{void (async()=>{
      syncing.current=true;
      try{
        const previous=baseline.current;
        const actor=workspace.actorId;
        const changedEvents=state.schedule.filter(e=>canonical(e)!==canonical(previous.schedule.find(x=>x.id===e.id)??null));
        const changedActions=(state.plan?.actions??[]).filter(e=>canonical(e)!==canonical(previous.plan?.actions.find(x=>x.id===e.id)??null));
        const removedEvents=previous.schedule.filter(e=>!state.schedule.some(x=>x.id===e.id));
        const removedActions=(previous.plan?.actions??[]).filter(e=>!state.plan?.actions.some(x=>x.id===e.id));
        const affected=[...new Set([...changedEvents.flatMap(e=>e.assigneeIds),...changedActions.flatMap(e=>e.participantIds),...removedEvents.flatMap(e=>e.assigneeIds),...removedActions.flatMap(e=>e.participantIds)])].filter(id=>id!==actor&&workspace.members.some(m=>m.userId===id&&m.status==='ACTIVE'));
        if(affected.length){
          const calendar=proposalCalendar(previous.schedule,state.schedule,workspace.records,workspace.family!.id);
          await workspace.save('proposal',crypto.randomUUID(),{title:'Review a proposed plan change',beforePlan:previous.plan,afterPlan:state.plan,beforeSchedule:calendar.before,afterSchedule:calendar.after,baseVersions:Object.fromEntries(workspace.records.filter(r=>r.kind==='plan'||calendar.recordIds.includes(r.id)).map(r=>[r.id,r.version])),requiredUserIds:affected,acceptedUserIds:[],status:'pending',createdAt:new Date().toISOString(),audience:'selected'}, {recipientIds:[actor,...affected],editorIds:[actor,...affected]});
          lastPersisted.current=canonical(previous);setState(previous);workspace.setError('Your proposed changes were sent for acceptance. The shared plan has not changed.');return;
        }
        const currentRows=splitState(state),oldRows=splitState(previous);
        const all=workspace.members.filter(m=>m.status==='ACTIVE').map(m=>m.userId);
        const adults=workspace.members.filter(m=>m.status==='ACTIVE'&&m.role!=='CHILD').map(m=>m.userId);
        const changes:import('@/workspace/Workspace').RecordChange[]=[];
        for(const row of currentRows){
          if(canonical(row.data)===canonical(oldRows.find(r=>r.id===row.id)?.data??null))continue;
          const privateSlice=['draft','student','assessment'].includes(row.kind);
          const memory=row.kind==='memory';const visibility=memory?String(row.data.visibility):'';
          const id=workspace.family!.id+':'+row.id+(privateSlice?':'+actor:'');
          const stored=workspace.records.find(r=>r.id===id);
          const audience=memory?(visibility==='Only me'?'private':visibility==='Selected members'?'selected':'family'):String(stored?.data.audience??(privateSlice?'private':'family'));
          const recipients=audience==='private'?[actor]:audience==='selected'?(memory?[actor,...(row.data.tagIds as string[]??[])]:stored?.recipientIds??[actor]):all;
          changes.push({kind:row.kind,id,data:{...row.data,audience},recipientIds:recipients,editorIds:audience==='family'&&row.kind!=='memory'&&row.kind!=='profile'?all:row.kind==='profile'?(stored?.editorIds??adults):[actor]});
          if(row.kind==='student'){
            const student=state.student,summary:Record<string,unknown>={updatedAt:new Date().toISOString(),audience:Object.values(student.shares).some(Boolean)?'family':'private'};
            if(student.shares.workload)summary.workloadMinutes=state.schedule.filter(e=>e.assigneeIds.includes(actor)&&e.category==='Study').reduce((n,e)=>n+Math.max(0,toMin(e.end)-toMin(e.start)),0);
            if(student.shares.exams)summary.exams=state.schedule.filter(e=>e.assigneeIds.includes(actor)&&e.exam).map(e=>({title:e.title,date:e.date,day:e.day}));
            if(student.shares.sleep&&student.sleepLog.length)summary.sleepAverage=student.sleepLog.reduce((n,h)=>n+h,0)/student.sleepLog.length;
            if(student.shares.support)summary.supportRequest=student.supportRequest;
            changes.push({kind:'student-summary',id:workspace.family!.id+':student-summary:'+actor,data:summary,recipientIds:Object.values(student.shares).some(Boolean)?all:[actor],editorIds:[actor]});
          }
        }
        for(const row of oldRows.filter(r=>!currentRows.some(x=>x.id===r.id))){const suffix=['draft','student','assessment'].includes(row.kind)?':'+actor:'';changes.push({kind:row.kind,id:workspace.family!.id+':'+row.id+suffix,data:row.data,deleted:true});}
        await workspace.saveMany(changes);
        if(captured===epoch.current){baseline.current=state;lastPersisted.current=canonical(state);}
      }catch(e){workspace.setError((e as Error).message);if(captured===epoch.current)setState(baseline.current);}
      finally{syncing.current=false;}
    })();},400);
    return()=>clearTimeout(timer);
  },[state,workspace.mode,workspace.identity,workspace.family]);

  // Accessibility preferences chosen in onboarding apply site-wide.
  useEffect(() => {
    const root = document.documentElement;
    const p = state.profile?.preferences;
    root.classList.toggle('pref-large-text', !!(display.largeText??p?.largeText));
    root.classList.toggle('pref-high-contrast', !!(display.highContrast??p?.highContrast));
    root.classList.toggle('pref-reduce-motion', !!(display.reduceMotion??p?.reduceMotion));
  }, [state.profile?.preferences,display]);

  const result = useMemo<AssessmentResult | null>(() => {
    if (!state.assessment) return null;
    try {
      return analyze(state.assessment.answers, state.profile, state.schedule);
    } catch {
      return null;
    }
  }, [state.assessment, state.profile, state.schedule]);

  const today = state.profile?.isDemo?todayIndex(true):((householdDate(new Date(),workspace.family?.timezone).getDay()+6)%7) as DayIndex;
  const patch = useCallback((p: Partial<AppState>) => setState((s) => ({ ...s, ...p })), []);

  const api = useMemo<AppApi>(
    () => ({
      ...state,
      result,
      today,
      canUndoSchedule: undo.length > 0,
      storageOk,
      restoreDemo: () => { workspace.enterDemo(); setUndo([]); setState(demoState()); },
      clearData: () => { setUndo([]); setState(emptyState()); },
      completeOnboarding: (p) => { setUndo([]); setState((s) => completeHousehold(s, p)); },
      updateProfile: (fn) => setState((s) => (s.profile ? { ...s, profile: fn(s.profile) } : s)),
      setDraft: (d) => patch({ draft: d }),
      submitAssessment: (rec) => setState((s) => ({ ...s, assessment: rec, draft: {} })),
      regeneratePlan: () =>
        setState((s) => ({
          ...s,
          plan: generatePlan(s.assessment?.answers ?? null, s.profile, s.schedule, { isSample: !!s.profile?.isDemo && s.assessment?.source === 'demo' }),
        })),
      updatePlan: (fn) => setState((s) => (s.plan ? { ...s, plan: fn(s.plan) } : s)),
      toggleAction: (id) =>
        setState((s) => (s.plan ? { ...s, plan: { ...s.plan, actions: s.plan.actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) } } : s)),
      editAction: (id, p) =>
        setState((s) => (s.plan ? { ...s, plan: { ...s.plan, isSample: false, actions: s.plan.actions.map((a) => (a.id === id ? { ...a, ...p, source: 'user' as const } : a)).sort((a, b) => a.day - b.day) } } : s)),
      deleteAction: (id) =>
        setState((s) => (s.plan ? { ...s, plan: { ...s.plan, isSample: false, actions: s.plan.actions.filter((a) => a.id !== id) } } : s)),
      addCoachActions: (t) => {
        const r = addActionsToPlan(state.plan, t, state.profile, state.schedule, 'coach');
        setState((s) => ({ ...s, plan: r.plan }));
        return { added: r.added.length, skipped: r.skipped };
      },
      addQuickActions: (actions) => {
        let plan=state.plan;const errors:string[]=[];
        for(const a of actions){const r=appendQuickAction(plan,a,state.profile?.preferences.maxDailyMinutes??90);errors.push(...r.errors);plan=r.plan;}
        if(!errors.length)setState(s=>({...s,plan}));return errors;
      },
      addQuickAction: (a) => {
        const r = appendQuickAction(state.plan, a, state.profile?.preferences.maxDailyMinutes ?? 90);
        if (!r.errors.length) setState((s) => ({ ...s, plan: r.plan }));
        return r.errors;
      },
      addEvent: (e) => setState((s) => ({ ...s, schedule: [...s.schedule, { ...e, date: e.date??dateForDay(e.day,new Date(),workspace.family?.timezone), id: uid('ev'), done: false }] })),
      updateEvent: (id, p) => setState((s) => ({ ...s, schedule: s.schedule.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
      deleteEvent: (id) => setState((s) => ({ ...s, schedule: s.schedule.filter((e) => e.id !== id) })),
      applyProposals: (props) => {
        setUndo((u) => [...u.slice(-9), { schedule: state.schedule, care: state.care }]);
        setState((s) => applyScheduleChanges(s, props));
      },
      undoSchedule: () => {
        const prev = undo[undo.length - 1];
        if (!prev) return;
        setUndo((u) => u.slice(0, -1));
        setState((s) => restoreSchedule(s, prev));
      },
      addMemory: (m) => setState((s) => ({ ...s, memories: [{ ...m, id: uid('mem') }, ...s.memories] })),
      updateMemory: (id, p) => setState((s) => ({ ...s, memories: s.memories.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
      deleteMemory: (id) => setState((s) => ({ ...s, memories: s.memories.filter((m) => m.id !== id) })),
      updateReminder: (id, fn) => setState((s) => ({ ...s, care: { ...s.care, reminders: s.care.reminders.map((r) => (r.id === id ? fn(r) : r)) } })),
      setCare: (fn) => setState((s) => ({ ...s, care: fn(s.care) })),
      updateStudent: (fn) => setState((s) => ({ ...s, student: fn(s.student) })),
    }),
    [state, result, today, undo, storageOk, patch, workspace.actorId, workspace.family],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
