import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clipboard, EyeOff, GraduationCap, Pause, Play, RotateCcw, Share2 } from 'lucide-react';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EmptyState, PageHeader, SafetyNotice, Switch } from '@/components/shared/Common';
import { MiniMeter } from '@/components/shared/Charts';
import { student as studentOf, eventMinutes } from '@/lib/people';
import { DAY_NAMES, DAY_SHORT, formatTime, minutesLabel, toMin } from '@/lib/time';
import { dayLoad, OVERLOAD_MINUTES } from '@/lib/scheduleOptimizer';
import { sanitizeText } from '@/lib/sanitize';
import { copyText } from '@/hooks/useCopy';

const FEELINGS = ['overloaded', 'tired', 'worried', 'stuck', 'under pressure'];
const BECAUSES = ['two assessments overlap', 'I am behind on revision', 'I am not sleeping well', 'there is a lot happening at home'];
const ASKS = ['move one responsibility', 'have a quiet evening', 'plan my study time together', 'talk for ten minutes'];
const UNTILS = ['Thursday', 'after my assessments', 'the weekend', 'next week'];

export default function Student() {
  useDocumentTitle('Student support');
  const { profile, schedule, student, updateStudent, today, restoreDemo } = useApp();
  const { toast } = useToast();
  const stu = studentOf(profile);
  const [feeling, setFeeling] = useState(FEELINGS[0]);
  const [because, setBecause] = useState(BECAUSES[0]);
  const [ask, setAsk] = useState(ASKS[0]);
  const [until, setUntil] = useState(UNTILS[0]);
  const [goalDraft, setGoalDraft] = useState(student.goal);
  const [sleepIn, setSleepIn] = useState('');
  const [sleepErr, setSleepErr] = useState('');

  const data = useMemo(() => {
    if (!stu) return null;
    const mine = schedule.filter((e) => e.assigneeIds.includes(stu.id));
    const exams = mine.filter((e) => e.exam).sort((a, b) => a.day - b.day);
    const study = mine.filter((e) => e.category === 'Study' && e.day >= today).sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
    const tasks = mine.filter((e) => e.category === 'Household Tasks');
    const peak = ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => ({ d, m: dayLoad(schedule, d)[stu.id] ?? 0 })).filter((x) => x.d >= today).sort((a, b) => b.m - a.m)[0];
    return { exams, study, tasks, taskMin: tasks.reduce((n, e) => n + eventMinutes(e), 0), peak, todayLoad: dayLoad(schedule, today)[stu.id] ?? 0 };
  }, [schedule, stu, today]);

  if (!profile || !stu || !data) {
    return (<><PageHeader title="Student support" /><EmptyState icon={<GraduationCap size={26} />} title="No student in this household" message="Add a student in household setup to see exam support, or restore the Al Noor demo."
      actions={<><Link to="/onboarding" className="btn btn-primary">Set up my household</Link><button type="button" className="btn btn-secondary" onClick={() => { restoreDemo(); toast('Al Noor demo restored.'); }}>Restore Al Noor demo</button></>} /></>);
  }

  const peakLevel = !data.peak ? 'No data' : data.peak.m > OVERLOAD_MINUTES ? 'Overloaded' : data.peak.m > 540 ? 'Heavy' : data.peak.m > 420 ? 'Busy' : 'Manageable';
  const nextExam = data.exams.find((e) => e.day >= today);
  const sentence = `I am feeling ${feeling} because ${because}. Could we ${ask} until ${until}?`;
  const nights = student.sleepLog;
  const range = nights.length ? Math.max(...nights) - Math.min(...nights) : 0;
  const avg = nights.length ? nights.reduce((a, b) => a + b, 0) / nights.length : 0;
  const target = (() => { let m = toMin(student.wake) - toMin(student.bedtime); if (m <= 0) m += 1440; return m / 60; })();
  const consistency = nights.length < 3 ? 'Not enough nights logged' : range <= 1 ? 'Consistent' : range <= 2 ? 'Somewhat inconsistent' : 'Inconsistent';

  const logSleep = () => {
    const v = Number(sleepIn.replace(',', '.'));
    if (!sleepIn || Number.isNaN(v) || v < 2 || v > 14) { setSleepErr('Enter hours between 2 and 14, for example 7.5.'); return; }
    updateStudent((s) => ({ ...s, sleepLog: [...s.sleepLog.slice(-6), Math.round(v * 2) / 2] }));
    setSleepIn(''); setSleepErr(''); toast(('Last night logged on this browser. Sharing controls demonstrate your preferences.'));
  };

  const shareSupport = () => {
    updateStudent((s) => ({ ...s, supportRequest: sanitizeText(sentence, 240), shares: { ...s.shares, support: true } }));
    toast('Support request shared with the household. You can turn this off any time.');
  };

  const sh = student.shares;
  return (
    <div className="stack stack-lg">
      <PageHeader eyebrow={`Student support · ${stu.name}${stu.grade ? `, ${stu.grade}` : ''}`} title="Study, rest & a little space." lede={("A space for study, rest, and asking for support. This prototype uses one shared browser workspace.")} />
      <SafetyNotice tone="info" title="You are in control.">{('Sharing controls demonstrate your preferences. There are no member accounts; anyone using this browser can open this page.')}</SafetyNotice>

      <div className="grid-12">
        <section className="card col-4 stack" aria-labelledby="wl-h">
          <h2 id="wl-h" className="card-title">Current workload</h2>
          <p><strong style={{ fontSize: 'var(--fs-2xl)' }}>{peakLevel}</strong></p>
          <MiniMeter value={Math.min(data.peak?.m ?? 0, 720)} max={720} label={`Busiest day: ${data.peak ? minutesLabel(data.peak.m) : 'none'} scheduled`} />
          <p className="small muted">Busiest upcoming day: {data.peak ? `${DAY_NAMES[data.peak.d]}, ${minutesLabel(data.peak.m)} scheduled` : 'none'}. Today: {minutesLabel(data.todayLoad)}.</p>
          <p className="small"><strong>Task load:</strong> {data.tasks.length} household task{data.tasks.length === 1 ? '' : 's'} this week ({minutesLabel(data.taskMin)}).</p>
        </section>

        <section className="card col-4 stack" aria-labelledby="ex-h">
          <h2 id="ex-h" className="card-title">Exam countdown</h2>
          {data.exams.length === 0 ? <p className="muted small">No assessments in the schedule. Add one as a School event.</p> : (
            <ul className="stack stack-sm" style={{ listStyle: 'none' }}>{data.exams.map((e) => { const left = e.day - today; return (<li key={e.id} className="between row"><span><strong>{e.title}</strong><br /><span className="xs muted">{DAY_NAMES[e.day]}, {formatTime(e.start)}</span></span><span className={left >= 0 ? 'pill pill-violet' : 'pill'}>{left < 0 ? 'Done' : left === 0 ? 'Today' : `${left} day${left === 1 ? '' : 's'}`}</span></li>); })}</ul>
          )}
          {nextExam && <p className="xs muted">Next: {nextExam.title}.</p>}
        </section>

        <section className="card col-4 stack" aria-labelledby="sb-h">
          <h2 id="sb-h" className="card-title">Study blocks</h2>
          {data.study.length === 0 ? <p className="muted small">No study blocks planned. Ask the Smart Schedule to protect one.</p> : (
            <ul className="stack stack-sm" style={{ listStyle: 'none' }}>{data.study.map((e) => (<li key={e.id}><strong>{DAY_SHORT[e.day]} {formatTime(e.start)}–{formatTime(e.end)}</strong> {e.protected && <span className="pill pill-ok">Protected</span>}<br /><span className="xs muted">{e.title}</span></li>))}</ul>
          )}
          <Link to="/schedule" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>Protect study time</Link>
        </section>

        <section className="card col-6 stack" aria-labelledby="goal-h">
          <h2 id="goal-h" className="card-title">Today’s achievable goal</h2>
          <div className="field"><label className="label" htmlFor="goal">One thing that would make today a good day</label><input id="goal" className="input" value={goalDraft} maxLength={120} onChange={(e) => setGoalDraft(e.target.value)} onBlur={() => updateStudent((s) => ({ ...s, goal: sanitizeText(goalDraft, 120) }))} /></div>
          <p className="xs muted">Keep it small enough to finish. Saved automatically on this device.</p>
          <FocusTimer />
        </section>

        <section className="card col-6 stack" aria-labelledby="sl-h">
          <h2 id="sl-h" className="card-title">Sleep routine</h2>
          <div className="grid grid-2">
            <div className="field"><label className="label" htmlFor="bed">Target bedtime</label><input id="bed" type="time" className="input" value={student.bedtime} onChange={(e) => updateStudent((s) => ({ ...s, bedtime: e.target.value || s.bedtime }))} /></div>
            <div className="field"><label className="label" htmlFor="wake">Wake time</label><input id="wake" type="time" className="input" value={student.wake} onChange={(e) => updateStudent((s) => ({ ...s, wake: e.target.value || s.wake }))} /></div>
          </div>
          <p className="small">Target sleep: <strong>{target.toFixed(1)} h</strong> · Last {nights.length} nights average: <strong>{avg ? avg.toFixed(1) : '—'} h</strong> · <span className={consistency === 'Consistent' ? 'pill pill-ok' : 'pill pill-warn'}>{consistency}</span></p>
          <div className="sleep-bars" role="img" aria-label={`Hours slept over the last ${nights.length} nights: ${nights.join(', ')}. Target ${target.toFixed(1)} hours.`}>
            {nights.map((h, i) => (<span key={i} className="sleep-bar" style={{ height: `${Math.min(100, (h / 10) * 100)}%` }}><i>{h}</i></span>))}
          </div>
          <div className="field"><label className="label" htmlFor="sl-in">Log last night (hours)</label>
            <div className="row"><input id="sl-in" className="input" inputMode="decimal" value={sleepIn} onChange={(e) => { setSleepIn(e.target.value); setSleepErr(''); }} aria-invalid={!!sleepErr} aria-describedby={sleepErr ? 'sl-err' : undefined} style={{ maxWidth: 140 }} /><button type="button" className="btn btn-secondary" onClick={logSleep}>Log sleep</button></div>
            {sleepErr && <span id="sl-err" className="error-text" role="alert">{sleepErr}</span>}</div>
        </section>

        <section className="card col-7 stack" aria-labelledby="ask-h">
          <h2 id="ask-h" className="card-title">Ask for support</h2>
          <p className="small muted">Build a clear, calm message. You can copy it or share it, or keep it to yourself.</p>
          <div className="grid grid-2">
            <div className="field"><label className="label" htmlFor="a-f">I am feeling</label><select id="a-f" className="select" value={feeling} onChange={(e) => setFeeling(e.target.value)}>{FEELINGS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="a-b">because</label><select id="a-b" className="select" value={because} onChange={(e) => setBecause(e.target.value)}>{BECAUSES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="a-a">Could we</label><select id="a-a" className="select" value={ask} onChange={(e) => setAsk(e.target.value)}>{ASKS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="a-u">until</label><select id="a-u" className="select" value={until} onChange={(e) => setUntil(e.target.value)}>{UNTILS.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
          <blockquote className="starter" aria-live="polite">{sentence}</blockquote>
          <div className="cluster">
            <button type="button" className="btn btn-secondary" onClick={async () => toast((await copyText(sentence)) ? 'Message copied. Send it however you prefer.' : 'Copy is not available here.')}><Clipboard size={16} aria-hidden /> Copy message</button>
            <button type="button" className="btn btn-royal" onClick={shareSupport}><Share2 size={16} aria-hidden /> Share Summary with household</button>
          </div>
          <div className="card card-tint stack stack-sm"><strong>Suggestion for the parent conversation</strong><p className="small">“What is one thing we can remove from this week to make it more manageable?” Listen first, then agree on one small change together.</p></div>
        </section>

        <section className="card col-5 stack" aria-labelledby="share-h">
          <h2 id="share-h" className="card-title"><EyeOff size={20} aria-hidden /> Sharing controls</h2>
          <Switch checked={sh.workload} onChange={(v) => updateStudent((s) => ({ ...s, shares: { ...s.shares, workload: v } }))} label="Workload level" description="e.g. “Heavy week”, not the details." />
          <Switch checked={sh.exams} onChange={(v) => updateStudent((s) => ({ ...s, shares: { ...s.shares, exams: v } }))} label="Exam dates" />
          <Switch checked={sh.support} onChange={(v) => updateStudent((s) => ({ ...s, shares: { ...s.shares, support: v } }))} label="My support request" />
          <Switch checked={sh.sleep} onChange={(v) => updateStudent((s) => ({ ...s, shares: { ...s.shares, sleep: v } }))} label="Sleep consistency summary" description="Only “consistent or not”, never the hours." />
          <div className="card card-tint stack stack-sm" aria-live="polite"><strong>What the household sees</strong>
            <ul className="small" style={{ paddingInlineStart: 18 }}>
              {sh.workload && <li>Workload: {peakLevel}</li>}
              {sh.exams && <li>Exams: {data.exams.map((e) => `${e.title} (${DAY_SHORT[e.day]})`).join(', ') || 'none'}</li>}
              {sh.support && <li>Request: {student.supportRequest || 'No request shared yet'}</li>}
              {sh.sleep && <li>Sleep: {consistency}</li>}
              {!sh.workload && !sh.exams && !sh.support && !sh.sleep && <li>Nothing is shared right now.</li>}
            </ul>
            <p className="xs muted">Private notes and exact feelings are never included.</p></div>
        </section>
      </div>
    </div>
  );
}

function FocusTimer() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const total = mode === 'focus' ? 25 * 60 : 5 * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const endRef = useRef(0);

  useEffect(() => { setLeft(mode === 'focus' ? 25 * 60 : 5 * 60); setRunning(false); }, [mode]);
  useEffect(() => {
    if (!running) return;
    endRef.current = Date.now() + left * 1000;
    const id = window.setInterval(() => {
      const r = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(r);
      if (r === 0) { window.clearInterval(id); setRunning(false); setMsg(mode === 'focus' ? 'Focus session complete. Take a 5-minute break.' : 'Break over. Ready when you are.'); }
    }, 500);
    return () => window.clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="card card-tint stack stack-sm">
      <div className="between row"><strong>Break timer</strong>
        <div className="tabs" role="group" aria-label="Timer mode"><button type="button" className="tab" aria-pressed={mode === 'focus'} onClick={() => { setMode('focus'); setMsg(''); }}>Focus 25</button><button type="button" className="tab" aria-pressed={mode === 'break'} onClick={() => { setMode('break'); setMsg(''); }}>Break 5</button></div></div>
      <div className="timer num" role="timer" aria-label={`${mm} minutes ${ss} seconds remaining`}>{mm}:{ss}</div>
      <MiniMeter value={total - left} max={total} label="Timer progress" />
      <div className="cluster">
        <button type="button" className="btn btn-royal btn-sm" onClick={() => { setMsg(''); setRunning((r) => !r); }} disabled={left === 0}>{running ? <><Pause size={16} aria-hidden /> Pause</> : <><Play size={16} aria-hidden /> {left < total ? 'Resume' : 'Start'}</>}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRunning(false); setLeft(total); setMsg(''); }}><RotateCcw size={16} aria-hidden /> Reset</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{msg}</p>
      {msg && <p className="small strong" aria-hidden>{msg}</p>}
    </div>
  );
}
