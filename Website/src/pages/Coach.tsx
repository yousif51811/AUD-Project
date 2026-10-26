import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Pencil, RotateCcw, Send, MessageCircle, Trash2, Undo2, X } from 'lucide-react';
import type { CoachResponse, DayIndex } from '@/types';
import { COACH_SCENARIOS } from '@/data/copy';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader, SafetyNotice } from '@/components/shared/Common';
import { Modal } from '@/components/shared/Modal';
import { getCoachResponse } from '@/lib/ai';
import { buildCoachResponse } from '@/lib/coach';
import { sanitizeText, uid } from '@/lib/sanitize';
import { DAY_NAMES } from '@/lib/time';
import { editCoachPlan } from '@/lib/coach';
import { copyText } from '@/hooks/useCopy';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';

interface Msg {
  id: string;
  role: 'user' | 'coach';
  text?: string;
  response?: CoachResponse;
  status: 'done' | 'rejected';
  edited?: boolean;
  added?: boolean;
  fellBack?: boolean;
}

const MAX = 300;

function toPlainText(r: CoachResponse): string {
  if (r.kind === 'safety') return r.reflection;
  return [r.reflection, `Pattern: ${r.pattern}`, `Today (${r.todayAction.minutes} min): ${r.todayAction.title}`, 'This week:', ...r.weekSteps.map((s, i) => `${i + 1}. ${s}`), `Conversation starter: ${r.conversationStarter}`, `Why this may help: ${r.why}`, r.safetyNote ? `Note: ${r.safetyNote}` : ''].filter(Boolean).join('\n');
}

export default function Coach() {
  useDocumentTitle('Talk it through');
  const { profile, schedule, assessment, addCoachActions } = useApp();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [editing, setEditing] = useState<Msg | null>(null);
  const generation = useRef(0);
  const alive = useRef(true);
  const logEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1; }; }, []);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }, [msgs.length, typing]);

  const ctx = () => ({ profile, events: schedule, answers: assessment?.answers ?? null });

  const send = async (raw: string) => {
    const text = sanitizeText(raw, MAX);
    if (!text || typing) return;
    const request = ++generation.current;
    setInput('');
    setAnnounce('');
    setMsgs((m) => [...m, { id: uid('u'), role: 'user', text, status: 'done' }]);
    setTyping(true);
    let response: CoachResponse;
    let fellBack = false;
    try {
      const res = await getCoachResponse(text, ctx());
      response = res.response; fellBack = res.fellBack;
    } catch {
      response = buildCoachResponse('general', ctx());
      fellBack = true;
    }
    if (!alive.current || request !== generation.current) return;
    setTyping(false);
    const id = uid('c');
    setMsgs((m) => [...m, { id, role: 'coach', response, status: 'done', fellBack }]);
    setAnnounce('Your suggestions are ready.');
  };

  const clear = () => { generation.current += 1; setMsgs([]); setTyping(false); setAnnounce('Conversation cleared.'); inputRef.current?.focus(); };
  const patch = (id: string, p: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const add = (m: Msg) => {
    if (!m.response) return;
    const r = addCoachActions(m.response.plan);
    patch(m.id, { added: true });
    toast(r.added ? `Added ${r.added} action${r.added === 1 ? '' : 's'} to the Weekly Plan${r.skipped ? ` (${r.skipped} already there)` : ''}.` : 'These actions are already in your Weekly Plan.', r.added ? 'ok' : 'warn');
  };

  const copy = async (m: Msg) => { if (!m.response) return; toast((await copyText(toPlainText(m.response))) ? 'Copied to clipboard.' : 'Copy is not available in this browser.', 'ok'); };

  return (
    <div className="stack stack-lg">
      <PageHeader eyebrow="Sometimes it helps to talk" title="What’s on your mind?" lede="Start with a situation, or put it in your own words. Take the suggestions that fit; leave the rest." />
      <div className="coach-grid">
        <aside className="card stack coach-side" aria-labelledby="sc-h">
          <h2 id="sc-h" className="card-title">Start with a situation</h2>
          <div className="scenario-list">
            {COACH_SCENARIOS.map((s) => (<button key={s.id} type="button" className="chip scenario-chip" disabled={typing} onClick={() => send(s.label)}>{s.label}</button>))}
          </div>
          <SafetyNotice tone="info" title="How it works.">These suggestions come from built-in rules and work offline. They use your family check-in and preferences; no live AI model is connected.</SafetyNotice>
        </aside>

        <section className="card chat" aria-label="Coach conversation">
          <div className="chat-head between row">
            <span className="pill pill-info"><MessageCircle size={16} aria-hidden /> A little help with the everyday</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={msgs.length === 0 && !typing}><Trash2 size={16} aria-hidden /> Clear conversation</button>
          </div>
          <div className="chat-log" role="log" aria-live="off" aria-label="Messages" tabIndex={0}>
            {msgs.length === 0 && !typing && (
              <div className="chat-empty">
                <p className="strong">What is on your mind this week?</p>
                <p className="muted small">Choose a situation or describe your own. You’ll get a small action for today, a few ideas for the week, and a gentle way to start the conversation.</p>
              </div>
            )}
            {msgs.map((m) => m.role === 'user' ? (
              <div key={m.id} className="msg msg-user"><span className="sr-only">You said: </span>{m.text}</div>
            ) : (
              <CoachMessage key={m.id} m={m} onAdd={() => add(m)} onCopy={() => copy(m)} onEdit={() => setEditing(m)} onReject={() => patch(m.id, { status: 'rejected' })} onRestore={() => patch(m.id, { status: 'done' })} />
            ))}
            {typing && <p className="small muted" role="status">Finding a small next step…</p>}
            <div ref={logEnd} />
          </div>
          <p className="sr-only" role="status" aria-live="polite">{announce}</p>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="label" htmlFor="coach-in">Describe what is happening</label>
              <textarea id="coach-in" ref={inputRef} className="textarea" style={{ minHeight: 64 }} rows={2} maxLength={MAX} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }} aria-describedby="coach-h" />
              <span id="coach-h" className="hint">Do not include medical emergencies here. {input.length}/{MAX}</span>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={!input.trim() || typing} aria-busy={typing}><Send size={18} aria-hidden /> Get guidance</button>
          </form>
        </section>
      </div>

      {editing?.response && (
        <EditDialog msg={editing} onClose={() => setEditing(null)} onSave={(r) => { patch(editing.id, { response: r, edited: true, added: false }); setEditing(null); toast('Recommendation updated. Review it, then add it to your plan.'); }} />
      )}
    </div>
  );
}

function CoachMessage({ m, onAdd, onCopy, onEdit, onReject, onRestore }: { m: Msg; onAdd: () => void; onCopy: () => void; onEdit: () => void; onReject: () => void; onRestore: () => void }) {
  const r=m.response!;
  if(r.kind==='safety') return <div className="msg msg-coach"><SafetyNotice tone="danger" title="Please read this.">{r.reflection}</SafetyNotice></div>;
  if(m.status==='rejected') return <div className="msg msg-coach"><p className="small muted">Set aside. Nothing has been changed.</p><button type="button" className="btn btn-ghost btn-sm" onClick={onRestore}><Undo2 size={15}/>Bring it back</button></div>;
  return <article className="msg msg-coach" aria-label="A suggestion for your family"><div className="stack">
    <p>{r.reflection}</p>
    <section className="coach-today"><h3 className="coach-h">One thing you could try today</h3><p><strong>{r.todayAction.title}</strong></p><span className="pill">About {r.todayAction.minutes} minutes</span></section>
    <blockquote className="starter">“{r.conversationStarter}”</blockquote>
    <details><summary>Why this suggestion?</summary><p>{r.pattern}</p><p>{r.why}</p></details>
    <details><summary>A few ideas for the rest of the week</summary><ol className="steps-ol">{r.weekSteps.map(step=><li key={step}>{step}</li>)}</ol></details>
    {r.safetyNote&&<SafetyNotice title="A note.">{r.safetyNote}</SafetyNotice>}
    <details><summary>What would go into our plan? ({r.plan.length} actions)</summary><ul className="steps-ol">{r.plan.map((a,i)=><li key={i}>{a.title} · {DAY_NAMES[a.day]} · {a.minutes} min</li>)}</ul><p className="xs muted">A full day moves the action to the next available day. Review the final placement in Our week.</p></details>
    <div className="cluster"><button type="button" className="btn btn-primary btn-sm" onClick={onAdd} disabled={m.added}>{m.added?<><Check size={15}/>Added to our plan</>:'Add to our plan'}</button><button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={14}/>Make it fit</button><button type="button" className="btn btn-ghost btn-sm" onClick={onReject}><X size={14}/>Leave it</button><button type="button" className="btn btn-ghost btn-sm" onClick={onCopy}><Clipboard size={14}/>Copy</button></div>
    <p className="xs muted">{m.edited?'Edited by you. ':''}{m.fellBack?'Built-in guidance was used. ':''}Offline suggestions, not professional or medical advice.</p>
  </div></article>;
}

function EditDialog({ msg, onClose, onSave }: { msg: Msg; onClose: () => void; onSave: (r: CoachResponse) => void }) {
  const r = msg.response!;
  const [today, setToday] = useState(r.todayAction.title);
  const [steps, setSteps] = useState(r.weekSteps.join('\n'));
  const [plan, setPlan] = useState(r.plan.map((a) => ({ ...a })));
  const [err, setErr] = useState('');
  const save = () => {
    const list = steps.split('\n').map((s) => sanitizeText(s, 240)).filter(Boolean);
    const t = sanitizeText(today, 200);
    if (!t) { setErr('Add an action for today.'); return; }
    if (list.length < 1) { setErr('Keep at least one step for the week.'); return; }
    if (plan.some((a) => !a.title.trim() || !Number.isFinite(a.minutes) || a.minutes < 1 || a.minutes > 120)) { setErr('Each plan action needs a title and 1–120 minutes.'); return; }
    onSave(editCoachPlan({ ...r, todayAction: { ...r.todayAction, title: t }, weekSteps: list.slice(0, 3) }, plan));
  };
  return (
    <Modal open title="Edit this recommendation" onClose={onClose} description="Edit the guidance and the exact actions that will be added to your plan."
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-royal" onClick={save}><RotateCcw size={0} aria-hidden /> Save changes</button></>}>
      <div className="field"><label className="label" htmlFor="ed-today">Action for today</label><input id="ed-today" data-autofocus className="input" value={today} maxLength={200} onChange={(e) => { setToday(e.target.value); setPlan((p) => p.map((a, i) => i === 0 ? { ...a, title: e.target.value } : a)); }} aria-invalid={!!err && !today.trim()} /></div>
      <div className="field"><label className="label" htmlFor="ed-steps">Steps for the week (one per line, up to three)</label><textarea id="ed-steps" className="textarea" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} /></div>
      <fieldset className="stack"><legend className="label">Actions to add to your plan</legend>
        {plan.map((a, i) => <div key={i} className="card card-tint stack stack-sm">
          <label className="label" htmlFor={`coach-plan-${i}`}>Plan action {i + 1}</label>
          <input id={`coach-plan-${i}`} className="input" value={a.title} maxLength={200} onChange={(e) => setPlan((p) => p.map((x, n) => n === i ? { ...x, title: e.target.value } : x))} />
          <div className="grid grid-2"><label className="field">Day<select className="select" value={a.day} onChange={(e) => setPlan((p) => p.map((x, n) => n === i ? { ...x, day: Number(e.target.value) as DayIndex } : x))}>{DAY_NAMES.map((d,n) => <option key={d} value={n}>{d}</option>)}</select></label>
          <label className="field">Minutes<input className="input" type="number" min="1" max="120" value={a.minutes} onChange={(e) => setPlan((p) => p.map((x, n) => n === i ? { ...x, minutes: Number(e.target.value) } : x))} /></label></div>
        </div>)}
      </fieldset>
      {err && <p className="error-text" role="alert">{err}</p>}
    </Modal>
  );
}
