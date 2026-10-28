import { dateForDay } from '@/lib/dates';
import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, CalendarPlus, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import type { DayIndex, EventCategory, ScheduleEvent } from '@/types';
import { EVENT_CATEGORIES } from '@/data/copy';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ChoiceCard, EmptyState, MemberAvatar, PageHeader, namesOf } from '@/components/shared/Common';
import { Modal } from '@/components/shared/Modal';
import { ResponsibilityChart } from '@/components/shared/Charts';
import { OptimizationComparison } from '@/components/schedule/OptimizationComparison';
import { balanceOf } from '@/lib/people';
import { DAY_NAMES, DAY_SHORT, formatTime, isValidTime, minutesLabel, toMin } from '@/lib/time';
import { dayLoad, detectConflicts, OVERLOAD_MINUTES } from '@/lib/scheduleOptimizer';
import { sanitizeText } from '@/lib/sanitize';

export default function Schedule() {
  useDocumentTitle('Smart schedule');
  const { schedule: allSchedule, profile, today, addEvent, updateEvent, deleteEvent, restoreDemo } = useApp();
  const { toast } = useToast();
  const [week,setWeek]=useState(dateForDay(0));
  const schedule=allSchedule.filter(e=>!e.date||dateForDay(0,new Date(e.date+'T12:00:00'))===week);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState<DayIndex>(today);
  const [filters, setFilters] = useState<EventCategory[]>([]);
  const [person, setPerson] = useState('all');
  const [editing, setEditing] = useState<ScheduleEvent | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ScheduleEvent | null>(null);

  const members = profile?.members ?? [];
  const conflicts = useMemo(() => detectConflicts(schedule), [schedule]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((c) => [c.a.id, c.b.id])), [conflicts]);
  const balance = useMemo(() => balanceOf(schedule, members), [schedule, members]);

  if (!profile) {
    return (<><PageHeader title="Smart schedule" /><EmptyState title="Set up a household first" message="The schedule needs household members to assign events and balance responsibilities."
      actions={<><a href="/onboarding" className="btn btn-primary">Set up my household</a><button type="button" className="btn btn-secondary" onClick={() => { restoreDemo(); toast('Al Noor demo restored.'); }}>Restore Al Noor demo</button></>} /></>);
  }

  const visible = (d: number) => schedule
    .filter((e) => e.day === d && (filters.length === 0 || filters.includes(e.category)) && (person === 'all' || e.assigneeIds.includes(person)))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  const days: DayIndex[] = view === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [day];

  const conflictText = (e: ScheduleEvent) => {
    const c = conflicts.find((x) => x.a.id === e.id || x.b.id === e.id);
    if (!c) return '';
    const other = c.a.id === e.id ? c.b : c.a;
    return `Overlaps with “${other.title}” for ${namesOf(c.memberIds, members)}`;
  };

  return (
    <div className="stack stack-lg">
      <PageHeader eyebrow="Smart schedule" title="The family calendar." lede="See the week as a whole, spot conflicts and overload early, and rebalance with confirmation."
        actions={<button type="button" className="btn btn-royal" onClick={() => setEditing('new')}><CalendarPlus size={18} aria-hidden /> Add event</button>} />

      {conflicts.length > 0 ? (
        <div className="notice notice-safety" role="status"><AlertTriangle size={20} aria-hidden /><div><strong>{conflicts.length} scheduling conflict{conflicts.length === 1 ? '' : 's'}.</strong> {conflicts.slice(0, 3).map((c) => `${DAY_SHORT[c.a.day]}: “${c.a.title}” and “${c.b.title}” (${namesOf(c.memberIds, members)})`).join('; ')}.</div></div>
      ) : <div className="notice notice-ok" role="status"><ShieldCheck size={20} aria-hidden /><div><strong>No conflicts.</strong> No one is double-booked this week.</div></div>}

      <label className="field" style={{maxWidth:280}}>Week containing<input type="date" className="input" value={week} onChange={e=>{if(e.target.value)setWeek(dateForDay(0,new Date(e.target.value+'T12:00:00')));}}/></label>
      <OptimizationComparison />

      <section className="card stack" aria-labelledby="bal-h">
        <h2 id="bal-h" style={{ fontSize: 'var(--fs-xl)' }}>Responsibility distribution</h2>
        <p className="muted small">Minutes of household tasks and older-adult care this week. Shared events are split evenly.</p>
        <ResponsibilityChart entries={balance} />
      </section>

      <section className="stack" aria-labelledby="cal-h">
        <div className="between row wrap-row">
          <h2 id="cal-h" style={{ fontSize: 'var(--fs-xl)' }}>Calendar</h2>
          <div className="tabs" role="group" aria-label="Calendar view">
            <button type="button" className="tab" aria-pressed={view === 'week'} onClick={() => setView('week')}>Week view</button>
            <button type="button" className="tab" aria-pressed={view === 'day'} onClick={() => setView('day')}>Day view</button>
          </div>
        </div>
        {view === 'day' && <div className="chip-scroll" role="group" aria-label="Choose a day">{DAY_NAMES.map((n, i) => <button key={n} type="button" className="chip" aria-pressed={day === i} onClick={() => setDay(i as DayIndex)}>{DAY_SHORT[i]}{i === today ? ' (today)' : ''}</button>)}</div>}
        <div className="chip-scroll" role="group" aria-label="Filter by category">
          <button type="button" className="chip" aria-pressed={filters.length === 0} onClick={() => setFilters([])}>All categories</button>
          {EVENT_CATEGORIES.map((c) => <button key={c} type="button" className="chip" aria-pressed={filters.includes(c)} onClick={() => setFilters((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]))}>{c}</button>)}
        </div>
        <div className="field" style={{ maxWidth: 280 }}><label className="label" htmlFor="person">Show events for</label>
          <select id="person" className="select" value={person} onChange={(e) => setPerson(e.target.value)}><option value="all">Whole household</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>

        <div className={`sched-grid${view === 'day' ? ' is-day' : ''}`}>
          {days.map((d) => {
            const list = visible(d);
            const load = dayLoad(schedule, d);
            const heavy = Object.entries(load).filter(([, m]) => m > OVERLOAD_MINUTES);
            return (
              <section key={d} className={`card sched-day${d === today ? ' is-today' : ''}`} aria-label={`${DAY_NAMES[d]} schedule`}>
                <div className="between row"><h3>{DAY_NAMES[d]}{d === today && <span className="pill pill-info" style={{ marginInlineStart: 8 }}>Today</span>}</h3><span className="xs muted">{list.length} event{list.length === 1 ? '' : 's'}</span></div>
                {heavy.map(([id, m]) => (<p key={id} className="overload-flag"><AlertTriangle size={14} aria-hidden /> Overloaded: {members.find((x) => x.id === id)?.name} ({minutesLabel(m)} scheduled)</p>))}
                {list.length === 0 && <p className="muted small">{schedule.some((e) => e.day === d) ? 'No events match your filters.' : 'No events. Room to breathe.'}</p>}
                <ul className="event-list">
                  {list.map((e) => (
                    <li key={e.id} className={`event cat-${e.category.replace(/\s+/g, '-').toLowerCase()}${e.done ? ' is-done' : ''}${conflictIds.has(e.id) ? ' is-conflict' : ''}`}>
                      <div className="event-main">
                        <span className="event-time num">{formatTime(e.start)}–{formatTime(e.end)}</span>
                        <strong className="event-title">{e.title}</strong>
                        <span className="event-meta"><span className="pill">{e.category}</span>{e.protected && <span className="pill pill-ok">Protected</span>}{e.exam && <span className="pill pill-violet">Assessment</span>}{e.done && <span className="pill pill-ok">Completed</span>}</span>
                        <span className="row" style={{ gap: 6 }}>{e.assigneeIds.map((id) => members.find((m) => m.id === id)).filter(Boolean).map((m) => <MemberAvatar key={m!.id} member={m!} size={22} />)}<span className="xs muted">{namesOf(e.assigneeIds, members)}{e.backupId ? ` · Backup: ${members.find((m) => m.id === e.backupId)?.name ?? ''}` : ''}</span></span>
                        {conflictIds.has(e.id) && <span className="conflict-text"><AlertCircle size={14} aria-hidden /> Conflict: {conflictText(e)}</span>}
                      </div>
                      <div className="event-btns">
                        <button type="button" className="btn btn-ghost btn-icon" aria-label={`${e.done ? 'Mark not done' : 'Mark complete'}: ${e.title}`} aria-pressed={e.done} onClick={() => updateEvent(e.id, { done: !e.done })}><Check size={18} aria-hidden /></button>
                        <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${e.title}`} onClick={() => setEditing(e)}><Pencil size={18} aria-hidden /></button>
                        <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete ${e.title}`} onClick={() => setDeleting(e)}><Trash2 size={18} aria-hidden /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>

      {editing && <EventEditor key={editing === 'new' ? 'new' : editing.id} target={editing} defaultDay={view === 'day' ? day : today} defaultDate={dateForDay(view === 'day'?day:today,new Date(week+'T12:00:00'))} onClose={() => setEditing(null)}
        onSave={(ev, isNew) => { if (isNew) { addEvent(ev); toast('Event added.'); } else { updateEvent((editing as ScheduleEvent).id, ev); toast('Event updated.'); } setEditing(null); }} />}
      <Modal open={!!deleting} alert title="Delete this event?" description={deleting ? `“${deleting.title}” on ${DAY_NAMES[deleting.day]} will be removed from the schedule.` : ''} onClose={() => setDeleting(null)}
        footer={<><button type="button" data-autofocus className="btn btn-ghost" onClick={() => setDeleting(null)}>Keep event</button><button type="button" className="btn btn-danger" onClick={() => { if (deleting) { const copy = deleting; deleteEvent(copy.id); toast('Event deleted.', 'warn', { label: 'Undo', run: () => addEvent({ ...copy }) }); } setDeleting(null); }}>Delete event</button></>}><span /></Modal>
    </div>
  );
}

type Draft = Omit<ScheduleEvent, 'id' | 'done'>;

function EventEditor({ target, defaultDay, defaultDate, onClose, onSave }: { target: ScheduleEvent | 'new'; defaultDay: DayIndex; defaultDate:string; onClose: () => void; onSave: (e: Draft, isNew: boolean) => void }) {
  const { profile, schedule } = useApp();
  const members = profile?.members ?? [];
  const isNew = target === 'new';
  const b = isNew ? null : target;
  const [title, setTitle] = useState(b?.title ?? '');
  const [category, setCategory] = useState<EventCategory>(b?.category ?? 'Family Time');
  const [day, setDay] = useState<DayIndex>(b?.day ?? defaultDay);
  const [date,setDate]=useState(b?.date??defaultDate);
  const [start, setStart] = useState(b?.start ?? '18:00');
  const [end, setEnd] = useState(b?.end ?? '18:30');
  const [who, setWho] = useState<string[]>(b?.assigneeIds ?? []);
  const [backup, setBackup] = useState(b?.backupId ?? '');
  const [flexible, setFlexible] = useState(!!b?.flexible);
  const [errs, setErrs] = useState<string[]>([]);

  const overlapping = isValidTime(start) && isValidTime(end) && toMin(end) > toMin(start)
    ? schedule.filter((e) => e.id !== b?.id && (e.date?e.date===date:e.day===day) && e.assigneeIds.some((id) => who.includes(id)) && toMin(e.start) < toMin(end) && toMin(start) < toMin(e.end)) : [];

  const save = () => {
    const e: string[] = [];
    const t = sanitizeText(title, 80);
    if (!t) e.push('Enter an event title.');
    if (!isValidTime(start) || !isValidTime(end)) e.push('Enter valid start and end times.');
    else if (toMin(end) <= toMin(start)) e.push('End time must be after the start time.');
    if (who.length === 0) e.push('Choose at least one person.');
    setErrs(e);
    if (e.length) return;
    onSave({ title: t, category, day, date, start, end, assigneeIds: who, backupId: backup && !who.includes(backup) ? backup : undefined, flexible, exam: b?.exam, protected: b?.protected, careReminder: b?.careReminder, notes: b?.notes }, isNew);
  };

  return (
    <Modal open wide title={isNew ? 'Add event' : 'Edit event'} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-royal" onClick={save}>{isNew ? 'Add to schedule' : 'Save changes'}</button></>}>
      {errs.length > 0 && <div className="error-summary" role="alert"><strong>Please fix:</strong><ul>{errs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div className="field"><label className="label" htmlFor="ev-t">Title</label><input id="ev-t" data-autofocus className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-invalid={errs.some((x) => x.includes('title'))} /></div>
      <div className="grid grid-2">
        <div className="field"><label className="label" htmlFor="ev-c">Category</label><select id="ev-c" className="select" value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label className="label" htmlFor="ev-date">Date</label><input id="ev-date" className="input" type="date" value={date} onChange={e=>{setDate(e.target.value);setDay(((new Date(e.target.value+'T12:00:00').getDay()+6)%7) as DayIndex);}}/><label className="label" htmlFor="ev-d">Day</label><select id="ev-d" className="select" value={day} onChange={(e) => {setDay(Number(e.target.value) as DayIndex);setDate(dateForDay(Number(e.target.value),new Date(date+'T12:00:00')));}}>{DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></div>
        <div className="field"><label className="label" htmlFor="ev-s">Start</label><input id="ev-s" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="ev-e">End</label><input id="ev-e" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <fieldset><legend className="label">Who is involved</legend><div className="choices" style={{ marginTop: 8 }}>{members.map((m) => <ChoiceCard key={m.id} type="checkbox" name="ev-who" value={m.id} label={m.name} hint={m.role} checked={who.includes(m.id)} onChange={(c) => setWho((x) => (c ? [...x, m.id] : x.filter((y) => y !== m.id)))} />)}</div></fieldset>
      {(category === 'Older Adult Care' || category === 'Health Routine') && <div className="field"><label className="label" htmlFor="ev-b">Backup person (optional)</label><select id="ev-b" className="select" value={backup} onChange={(e) => setBackup(e.target.value)}><option value="">No backup</option>{members.filter((m) => !who.includes(m.id) && m.ageGroup === 'adult').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><span className="hint">Backup people are only notified when everyone has agreed.</span></div>}
      {(category === 'Household Tasks') && <ChoiceCard type="checkbox" name="ev-flex" value="flex" label="This task is nonurgent" hint="The optimizer may propose moving it, but never without confirmation." checked={flexible} onChange={setFlexible} />}
      {overlapping.length > 0 && <div className="notice notice-safety" role="status"><AlertTriangle size={18} aria-hidden /><span>This overlaps with {overlapping.map((o) => `“${o.title}”`).join(', ')}. You can still save it.</span></div>}
    </Modal>
  );
}
