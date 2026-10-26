import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2, X, AlertCircle } from 'lucide-react';
import type { ActivityType, AgeGroup, DayIndex, FamilyMember, GoalId, HouseholdProfile, MemberColor, SharedWindow } from '@/types';
import { ACTIVITIES, GOALS } from '@/data/copy';
import { DEFAULT_CONSENT, DEFAULT_PREFERENCES } from '@/data/demo';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ChoiceCard, MemberAvatar, SafetyNotice, Switch, PageHeader } from '@/components/shared/Common';
import { DAY_NAMES, isValidTime, toMin } from '@/lib/time';
import { sanitizeText, uid } from '@/lib/sanitize';

const STEPS = ['Welcome', 'Household', 'Goals', 'Privacy', 'Preferences'];
const ROLES: [string, AgeGroup][] = [
  ['Father', 'adult'], ['Mother', 'adult'], ['Parent or guardian', 'adult'], ['Grandmother', 'older'], ['Grandfather', 'older'],
  ['Older family member', 'older'], ['Teenage student', 'teen'], ['Student', 'child'], ['Child', 'child'], ['Sibling or relative', 'adult'],
];
const COLORS: { id: MemberColor; label: string }[] = [
  { id: 'blue', label: 'Blue' }, { id: 'teal', label: 'Teal' }, { id: 'gold', label: 'Gold' }, { id: 'violet', label: 'Violet' }, { id: 'red', label: 'Rose' },
];
const ICONS: FamilyMember['icon'][] = ['orbit', 'leaf', 'spark', 'wave', 'star'];
const A11Y = ['Large text', 'High contrast', 'Simple language', 'Screen reader'];

interface Draft {
  name: string; members: FamilyMember[]; goals: GoalId[];
  consent: HouseholdProfile['consent']; prefs: HouseholdProfile['preferences'];
}

function initial(p: HouseholdProfile | null): Draft {
  if (p && !p.isDemo) return { name: p.name, members: p.members, goals: p.goals, consent: p.consent, prefs: p.preferences };
  return { name: '', members: [], goals: [], consent: { fields: { ...DEFAULT_CONSENT.fields }, allowBackupNotification: false }, prefs: { ...DEFAULT_PREFERENCES, windows: [], activities: ['walk', 'meal'] } };
}

export default function Onboarding() {
  useDocumentTitle('Household setup');
  const { profile, restoreDemo, completeOnboarding } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => initial(profile));
  const [errors, setErrors] = useState<string[]>([]);
  const headRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (step > 0 || errors.length === 0) headRef.current?.focus({ preventScroll: false }); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (errors.length) summaryRef.current?.focus(); }, [errors]);

  const validate = (s: number): string[] => {
    const e: string[] = [];
    if (s === 1) {
      if (!d.name.trim()) e.push('Enter a name for your household, for example “The Hassan Family”.');
      if (d.members.length < 1) e.push('Add at least one household member.');
    }
    if (s === 2 && d.goals.length < 1) e.push('Choose at least one family goal. You can change it later.');
    if (s === 4 && d.prefs.maxDailyMinutes < 10) e.push('Choose a daily family-action time limit.');
    return e;
  };
  const next = () => { const e = validate(step); setErrors(e); if (!e.length) setStep((s) => Math.min(4, s + 1)); };
  const back = () => { setErrors([]); setStep((s) => Math.max(0, s - 1)); };

  const finish = () => {
    const e = [...validate(1), ...validate(2), ...validate(4)];
    setErrors(e);
    if (e.length) return;
    const p: HouseholdProfile = { id: uid('house'), name: sanitizeText(d.name, 60), members: d.members, goals: d.goals, consent: d.consent, preferences: d.prefs, isDemo: false };
    completeOnboarding(p);
    toast('Household created. Next: your family check-in.');
    nav('/assessment');
  };

  const useDemo = () => { restoreDemo(); toast('Al Noor demo family loaded.'); nav('/dashboard'); };

  return (
    <div className="container container-narrow section-tight stack stack-lg">
      <PageHeader eyebrow={`Household setup · Step ${step + 1} of 5`} title="Make yourself at home." lede="Five short steps. You stay in control of what is shared, and everything stays on this device." actions={<button type="button" className="btn btn-secondary" onClick={useDemo}><Sparkles size={18} aria-hidden /> Use Al Noor Demo Family</button>} />
      <ol className="stepper" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="stepper-dot">{i < step ? <Check size={14} aria-hidden /> : i + 1}</span><span className="stepper-label">{s}</span>
            {i < step && <span className="sr-only"> (completed)</span>}
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <strong><AlertCircle size={18} aria-hidden style={{ display: 'inline', verticalAlign: '-3px' }} /> Please fix {errors.length === 1 ? 'this' : 'these'} before continuing</strong>
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <section className="card stack stack-lg" aria-labelledby="step-title">
        {step === 0 && <StepWelcome headRef={headRef} isDemo={!!profile?.isDemo} />}
        {step === 1 && <StepMembers headRef={headRef} d={d} setD={setD} />}
        {step === 2 && <StepGoals headRef={headRef} d={d} setD={setD} />}
        {step === 3 && <StepPrivacy headRef={headRef} d={d} setD={setD} />}
        {step === 4 && <StepPrefs headRef={headRef} d={d} setD={setD} />}
        <div className="between row wrap-row">
          <button type="button" className="btn btn-ghost" onClick={back} disabled={step === 0}><ArrowLeft size={18} aria-hidden /> Back</button>
          {step < 4
            ? <button type="button" className="btn btn-royal" onClick={next}>{step === 0 ? 'I understand, set up my household' : 'Continue'} <ArrowRight size={18} aria-hidden /></button>
            : <button type="button" className="btn btn-primary btn-lg" onClick={finish}>Create my household <Check size={18} aria-hidden /></button>}
        </div>
      </section>
      <p className="xs muted">Prefer to explore first? <Link to="/demo">Launch the judge demo</Link> or <button type="button" className="linklike" onClick={useDemo}>load the Al Noor demo family</button>.</p>
    </div>
  );
}

type SP = { headRef: React.RefObject<HTMLHeadingElement | null>; d: Draft; setD: React.Dispatch<React.SetStateAction<Draft>> };

function StepWelcome({ headRef, isDemo }: { headRef: SP['headRef']; isDemo: boolean }) {
  return (
    <>
      <div className="stack stack-sm">
        <h2 id="step-title" tabIndex={-1} ref={headRef}>Welcome. Here is what FamilyMind AI does, and does not do.</h2>
        <p className="muted">AI should not replace family conversations. It should help families start better ones.</p>
      </div>
      <div className="grid grid-2">
        <div className="card card-tint stack stack-sm">
          <h3>FamilyMind AI does</h3>
          <ul className="tick-list">
            <li>Connect only the signals your family chooses to share</li>
            <li>Explain every suggestion in plain language</li>
            <li>Turn suggestions into small, editable family actions</li>
            <li>Keep the family in control of every change</li>
          </ul>
        </div>
        <div className="card card-tint stack stack-sm">
          <h3>FamilyMind AI does not</h3>
          <ul className="cross-list">
            <li>Diagnose medical or mental-health conditions</li>
            <li>Monitor emergencies or replace professionals</li>
            <li>Secretly read private entries or messages</li>
            <li>Predict or prevent every family crisis</li>
          </ul>
        </div>
      </div>
      <SafetyNotice title="Not a medical tool.">The family remains in control. Prototype data stays in this browser and can be reset at any time.</SafetyNotice>
      {isDemo && <p className="notice"><span>You are currently viewing the fictional Al Noor demo. Creating your own household replaces demo data on this device.</span></p>}
    </>
  );
}

function StepMembers({ headRef, d, setD }: SP) {
  const [name, setName] = useState('');
  const [roleIdx, setRoleIdx] = useState(0);
  const [age, setAge] = useState('');
  const [color, setColor] = useState<MemberColor>('blue');
  const [a11y, setA11y] = useState<string[]>([]);
  const [shares, setShares] = useState(true);
  const [err, setErr] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const n = sanitizeText(name, 40);
    if (!n) { setErr('Enter a first name or nickname.'); nameRef.current?.focus(); return; }
    if (d.members.some((m) => m.name.toLowerCase() === n.toLowerCase())) { setErr('That name is already in the household. Use a different nickname.'); nameRef.current?.focus(); return; }
    const ageNum = age ? Number(age) : undefined;
    if (age && (!Number.isInteger(ageNum) || (ageNum as number) < 1 || (ageNum as number) > 110)) { setErr('Age must be a whole number between 1 and 110, or leave it blank.'); return; }
    const [role, ageGroup] = ROLES[roleIdx];
    const m: FamilyMember = { id: uid('m'), name: n, role, age: ageNum, ageGroup, color, icon: ICONS[d.members.length % ICONS.length], accessibility: a11y, sharesSummaries: shares };
    setD((x) => ({ ...x, members: [...x.members, m] }));
    setName(''); setAge(''); setA11y([]); setErr('');
    nameRef.current?.focus();
  };

  return (
    <>
      <div className="stack stack-sm">
        <h2 id="step-title" tabIndex={-1} ref={headRef}>Who is in your household?</h2>
        <p className="muted">Use first names or nicknames. Add everyone who shares the household plan, across generations.</p>
      </div>
      <div className="field">
        <label className="label" htmlFor="hh-name">Household name</label>
        <input id="hh-name" className="input" value={d.name} maxLength={60} onChange={(e) => setD({ ...d, name: e.target.value })} autoComplete="off" aria-describedby="hh-name-h" />
        <span className="hint" id="hh-name-h">For example “The Al Noor Family”.</span>
      </div>
      {d.members.length > 0 ? (
        <ul className="member-list" aria-label="Household members">
          {d.members.map((m) => (
            <li key={m.id} className="member-row">
              <MemberAvatar member={m} />
              <div className="grow"><div className="strong">{m.name}</div><div className="xs muted">{m.role}{m.age ? ` · ${m.age}` : ''}{m.accessibility.length ? ` · ${m.accessibility.join(', ')}` : ''} · {m.sharesSummaries ? 'Shares summaries' : 'Keeps summaries private'}</div></div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${m.name}`} onClick={() => setD((x) => ({ ...x, members: x.members.filter((y) => y.id !== m.id) }))}><Trash2 size={18} aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : <p className="notice" role="note"><span>No members yet. Add the first person below.</span></p>}
      <fieldset className="card card-tint stack">
        <legend className="label">Add a household member</legend>
        <div className="grid grid-2">
          <div className="field">
            <label className="label" htmlFor="m-name">First name or nickname</label>
            <input id="m-name" ref={nameRef} className="input" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setErr(''); }} aria-invalid={!!err} aria-describedby={err ? 'm-err' : undefined} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} autoComplete="off" />
          </div>
          <div className="field">
            <label className="label" htmlFor="m-role">Role</label>
            <select id="m-role" className="select" value={roleIdx} onChange={(e) => setRoleIdx(Number(e.target.value))}>{ROLES.map((r, i) => <option key={r[0]} value={i}>{r[0]}</option>)}</select>
          </div>
          <div className="field">
            <label className="label" htmlFor="m-age">Age (optional)</label>
            <input id="m-age" className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </div>
          <fieldset className="field">
            <legend className="label">Profile colour</legend>
            <div className="cluster">
              {COLORS.map((c) => (
                <label key={c.id} className="color-pick"><input type="radio" name="m-color" checked={color === c.id} onChange={() => setColor(c.id)} /><span className={`avatar c-${c.id}`} style={{ ['--sz' as string]: '44px' }}>{c.label[0]}</span><span className="sr-only">{c.label}</span></label>
              ))}
            </div>
          </fieldset>
        </div>
        <fieldset className="field">
          <legend className="label">Accessibility preferences (optional)</legend>
          <div className="choices">{A11Y.map((a) => <ChoiceCard key={a} type="checkbox" name="m-a11y" value={a} label={a} checked={a11y.includes(a)} onChange={(c) => setA11y((x) => (c ? [...x, a] : x.filter((y) => y !== a)))} />)}</div>
        </fieldset>
        <Switch checked={shares} onChange={setShares} label="Participates in shared household summaries" description="Summary preferences are stored locally. This prototype has no member accounts." />
        {err && <p id="m-err" className="error-text" role="alert"><AlertCircle size={16} aria-hidden /> {err}</p>}
        <button type="button" className="btn btn-royal" onClick={add} style={{ alignSelf: 'flex-start' }}><Plus size={18} aria-hidden /> Add to household</button>
      </fieldset>
    </>
  );
}

function StepGoals({ headRef, d, setD }: SP) {
  return (
    <>
      <div className="stack stack-sm">
        <h2 id="step-title" tabIndex={-1} ref={headRef}>What would you like to strengthen?</h2>
        <p className="muted">Choose one or more goals. They help rank suggestions, and you can change them any time.</p>
      </div>
      <fieldset>
        <legend className="sr-only">Family goals</legend>
        <div className="choices">
          {GOALS.map((g) => <ChoiceCard key={g.id} type="checkbox" name="goals" value={g.id} label={g.label} hint={g.hint} checked={d.goals.includes(g.id)} onChange={(c) => setD((x) => ({ ...x, goals: c ? [...x.goals, g.id] : x.goals.filter((y) => y !== g.id) }))} />)}
        </div>
      </fieldset>
    </>
  );
}

function StepPrivacy({ headRef, d, setD }: SP) {
  const f = d.consent.fields;
  const set = (k: keyof typeof f, v: boolean) => setD((x) => ({ ...x, consent: { ...x.consent, fields: { ...x.consent.fields, [k]: v } } }));
  return (
    <>
      <div className="stack stack-sm">
        <h2 id="step-title" tabIndex={-1} ref={headRef}>Privacy and sharing</h2>
        <p className="muted">Decide what the household summary may include. Members can also decide for themselves.</p>
      </div>
      <ul className="tick-list">
        <li>Visibility settings demonstrate intended sharing; this browser is a shared workspace.</li>
        <li>Household summaries contain only selected information.</li>
        <li>Sharing can be revoked at any time.</li>
        <li>Prototype data can be reset.</li>
        <li>No secret monitoring is permitted.</li>
      </ul>
      <div className="stack">
        <Switch checked={f.mood} onChange={(v) => set('mood', v)} label="Household mood summary" description="A combined, household-level trend. Never individual entries." />
        <Switch checked={f.workload} onChange={(v) => set('workload', v)} label="Workload level" description="For example “busy week”, not the details behind it." />
        <Switch checked={f.sleep} onChange={(v) => set('sleep', v)} label="Sleep consistency summary" description="Off by default. Shows only whether routines are steady." />
        <Switch checked={f.careStatus} onChange={(v) => set('careStatus', v)} label="Care routine status" description="Whether reminders were completed, not health details." />
        <Switch checked={f.schedule} onChange={(v) => set('schedule', v)} label="Shared schedule" description="Events assigned to a member are visible to the household." />
        <Switch checked={d.consent.allowBackupNotification} onChange={(v) => setD((x) => ({ ...x, consent: { ...x.consent, allowBackupNotification: v } }))} label="Allow a backup person to be notified for required care reminders" description="Only after the person receiving care and the backup both agree." />
      </div>
    </>
  );
}

function StepPrefs({ headRef, d, setD }: SP) {
  const p = d.prefs;
  const [day, setDay] = useState<DayIndex>(4);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [werr, setWerr] = useState('');
  const setP = (patch: Partial<typeof p>) => setD((x) => ({ ...x, prefs: { ...x.prefs, ...patch } }));
  const addWindow = () => {
    if (!isValidTime(start) || !isValidTime(end) || toMin(end) - toMin(start) < 20) { setWerr('Choose a start and end time at least 20 minutes apart.'); return; }
    const w: SharedWindow = { day, start, end };
    setP({ windows: [...p.windows, w] }); setWerr('');
  };
  const reminders = useMemo(() => [['gentle', 'Gentle', 'One quiet reminder'], ['standard', 'Standard', 'A reminder and one follow-up'], ['minimal', 'Minimal', 'Only for required routines']] as const, []);
  return (
    <>
      <div className="stack stack-sm">
        <h2 id="step-title" tabIndex={-1} ref={headRef}>Preferences</h2>
        <p className="muted">These keep suggestions realistic for your week.</p>
      </div>
      <fieldset><legend className="label">Reminder style</legend>
        <div className="choices">{reminders.map(([id, l, h]) => <ChoiceCard key={id} name="rem" value={id} label={l} hint={h} checked={p.reminders === id} onChange={() => setP({ reminders: id })} />)}</div>
      </fieldset>
      <fieldset><legend className="label">Activities your family enjoys</legend>
        <div className="choices">{ACTIVITIES.map((a) => <ChoiceCard key={a.id} type="checkbox" name="acts" value={a.id} label={a.label} checked={p.activities.includes(a.id)} onChange={(c) => setP({ activities: c ? [...p.activities, a.id as ActivityType] : p.activities.filter((y) => y !== a.id) })} />)}</div>
      </fieldset>
      <fieldset className="stack"><legend className="label">Shared times everyone is usually free</legend>
        {p.windows.length > 0 && <ul className="member-list">{p.windows.map((w, i) => <li key={i} className="member-row"><span className="grow">{DAY_NAMES[w.day]}, {w.start}–{w.end}</span><button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${DAY_NAMES[w.day]} window`} onClick={() => setP({ windows: p.windows.filter((_, j) => j !== i) })}><X size={18} aria-hidden /></button></li>)}</ul>}
        <div className="grid grid-3">
          <div className="field"><label className="label" htmlFor="w-day">Day</label><select id="w-day" className="select" value={day} onChange={(e) => setDay(Number(e.target.value) as DayIndex)}>{DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="w-s">From</label><input id="w-s" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="w-e">Until</label><input id="w-e" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        {werr && <p className="error-text" role="alert"><AlertCircle size={16} aria-hidden /> {werr}</p>}
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={addWindow}><Plus size={18} aria-hidden /> Add shared time</button>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="maxmin">Maximum family-action time per day</label>
        <select id="maxmin" className="select" value={p.maxDailyMinutes} onChange={(e) => setP({ maxDailyMinutes: Number(e.target.value) })}>
          {[20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
        <span className="hint">Plans never exceed two small actions a day.</span>
      </div>
      <fieldset className="stack"><legend className="label">Accessibility options</legend>
        <Switch checked={p.largeText} onChange={(v) => setP({ largeText: v })} label="Larger text" />
        <Switch checked={p.highContrast} onChange={(v) => setP({ highContrast: v })} label="Higher contrast" />
        <Switch checked={p.reduceMotion} onChange={(v) => setP({ reduceMotion: v })} label="Reduce motion" description="Also follows your device setting automatically." />
      </fieldset>
    </>
  );
}
