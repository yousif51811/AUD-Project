import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Maximize2, Play, RotateCcw, StickyNote, X } from 'lucide-react';
import { DEMO_STEPS, GOALS, QUESTIONS } from '@/data/copy';
import { DEMO_ANSWERS, demoSchedule } from '@/data/demo';
import { useApp } from '@/state/store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ExplainabilityPanel, MemberAvatar, SafetyNotice } from '@/components/shared/Common';
import { CategoryScoreBar, ScoreRing } from '@/components/shared/Charts';
import { OptimizationComparison } from '@/components/schedule/OptimizationComparison';
import { PrivacyMatrix } from '@/components/trust/PrivacyMatrix';
import { WhyPanel } from '@/components/trust/WhyPanel';
import { Modal } from '@/components/shared/Modal';
import { DAY_NAMES } from '@/lib/time';
import { eventMinutes } from '@/lib/people';

const SITUATIONS: Record<string, { situation: string; goal: string }> = {
  omar: { situation: 'Busy work schedule', goal: 'Protect family time and improve household coordination' },
  mariam: { situation: 'Balances work, household planning and care responsibilities', goal: 'A fairer distribution of responsibilities' },
  zayed: { situation: 'Two assessments within three days', goal: 'Manage exam pressure, sleep, study time and household duties' },
  latifa: { situation: 'Needs a more consistent homework and sleep routine', goal: 'Build a manageable daily routine' },
  fatima: { situation: 'Benefits from medication, hydration, movement and family-call reminders', goal: 'Keep routines steady and stay connected' },
};

export default function Demo() {
  useDocumentTitle('Meet the sample family');
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const app = useApp();
  const { profile, result, plan, schedule, restoreDemo, regeneratePlan } = app;
  const raw = Number(sp.get('step') ?? '0');
  const step = Number.isInteger(raw) && raw >= 0 && raw <= 8 ? raw : 0;
  const [notes, setNotes] = useState(false);
  const [ran, setRan] = useState(false);
  const [planned, setPlanned] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => { if (first.current) { first.current = false; return; } headRef.current?.focus(); window.scrollTo(0, 0); }, [step]);

  const go = (n: number) => setSp({ step: String(Math.max(0, Math.min(8, n))) }, { replace: false });
  const begin = () => { restoreDemo(); setRan(false); setPlanned(false); setConfirmReplace(false); go(1); };
  const restart = () => { restoreDemo(); setRan(false); setPlanned(false); go(1); };
  const fullscreen = () => { try { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); } catch { /* unsupported */ } };

  const outcome = useMemo(() => {
    const base = demoSchedule();
    const rebalanced = schedule.filter((e) => { const b = base.find((x) => x.id === e.id); return b && b.assigneeIds.join() !== e.assigneeIds.join() && e.category === 'Household Tasks'; }).length;
    const study = schedule.filter((e) => e.protected && e.category === 'Study').length;
    const backups = new Set(schedule.filter((e) => e.careReminder && e.backupId).map((e) => e.title)).size;
    const family = schedule.filter((e) => e.id.startsWith('opt-ev-') && e.category === 'Family Time').reduce((n, e) => n + eventMinutes(e), 0);
    return { rebalanced, study, backups, family, any: rebalanced + study + backups + family > 0 };
  }, [schedule]);

  const isCustom = !!profile && !profile.isDemo;
  const title = step === 0 ? 'Meet the Al Noor family.' : DEMO_STEPS[step - 1].title;

  return (
    <div className="container section-tight stack stack-lg demo-page">
      <div className="between row wrap-row demo-bar">
        <div className="stack stack-sm"><span className="eyebrow">{step === 0 ? 'A family week, in three to five minutes' : `Step ${step} of 8`}</span></div>
        <div className="cluster">
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={notes} onClick={() => setNotes((n) => !n)}><StickyNote size={16} aria-hidden /> Presenter notes</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={fullscreen}><Maximize2 size={16} aria-hidden /> Full screen</button>
          {step > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={restart}><RotateCcw size={16} aria-hidden /> Start over</button>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => nav('/')}><X size={16} aria-hidden /> Back to home</button>
        </div>
      </div>

      <div className="demo-layout">
        <nav aria-label="Demo progress" className="demo-rail">
          <ol>
            {DEMO_STEPS.map((s, i) => (
              <li key={s.id} className={i + 1 === step ? 'current' : i + 1 < step ? 'done' : ''}>
                <button type="button" onClick={() => go(i + 1)} aria-label={`Step ${i + 1}: ${s.short}`} aria-current={i + 1 === step ? 'step' : undefined}>
                  <span className="stepper-dot">{i + 1 < step ? <Check size={14} aria-hidden /> : i + 1}</span><span className="rail-label">{s.short}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="demo-stage stack stack-lg" aria-labelledby="demo-title">
          <h1 id="demo-title" tabIndex={-1} ref={headRef} style={{ fontSize: 'var(--fs-2xl)' }}>{title}</h1>
          {notes && step > 0 && <div className="notice notice-safety" role="note"><StickyNote size={20} aria-hidden /><div><strong>Presenter note.</strong> {DEMO_STEPS[step - 1].notes}</div></div>}

          {step === 0 && (
            <div className="stack stack-lg">
              <p className="lede">Meet the fictional Al Noor family and watch FamilyMind AI turn scattered signals into one explained, family-approved plan. The planning tools work without a live model. Connect Groq, Gemini or OpenRouter from your browser for contextual suggestions, with no model download.</p>
              <ul className="tick-list">
                <li>Eight steps, about three to five minutes.</li>
                <li>Loads the deterministic Al Noor demo data on this device.</li>
                <li>Fictional records, isolated to this browser session. AI suggestions are labelled separately from built-in tools.</li>
              </ul>
              {isCustom && <SafetyNotice tone="danger" title="Heads up.">Your own household data is on this device. Starting the demo replaces it with the Al Noor demo data.</SafetyNotice>}
              <div><button type="button" className="btn btn-primary btn-lg" onClick={() => (isCustom ? setConfirmReplace(true) : begin())}><Play size={20} aria-hidden /> Meet the family</button></div>
            </div>
          )}

          {step === 1 && (
            <div className="stack stack-lg">
              <p className="lede">Three generations, one UAE household, one shared week.</p>
              <ul className="grid grid-3 family-cards">
                {(profile?.members ?? []).map((m) => (
                  <li key={m.id} className="card stack stack-sm">
                    <div className="row"><MemberAvatar member={m} size={44} /><div><strong>{m.name} Al Noor</strong><br /><span className="xs muted">{m.role}{m.age ? `, ${m.age}` : ''}</span></div></div>
                    <p className="small"><strong>Situation:</strong> {SITUATIONS[m.id]?.situation}</p>
                    <p className="small"><strong>Goal:</strong> {SITUATIONS[m.id]?.goal}</p>
                  </li>
                ))}
              </ul>
              <p className="small muted">Family goals chosen: {(profile?.goals ?? []).map((g) => GOALS.find((x) => x.id === g)?.label).join(' · ')}.</p>
            </div>
          )}

          {step === 2 && result && (
            <div className="stack stack-lg">
              <p className="lede">Each signal alone looks small. Connected, they tell one story.</p>
              <ul className="signal-cards">{result.signals.map((s, i) => <li key={s.id} className="signal-card card" style={{ ['--i' as string]: i }}><span className={s.severity === 'attention' ? 'pill pill-warn' : 'pill'}>{s.severity === 'attention' ? 'Needs attention' : 'Worth watching'}</span><span className="signal-text">{s.label}</span></li>)}</ul>
              <div className="insight card card-dark"><p className="insight-text">Connected pattern: {result.recommendations[0].pattern}</p></div>
              <p className="strong">This family does not need more notifications. It needs one coordinated plan.</p>
            </div>
          )}

          {step === 3 && (
            <div className="stack stack-lg">
              <p className="lede">Eight questions. These are the Al Noor family’s answers, prefilled so the demo is identical every time.</p>
              <ul className="review-list card card-tint">
                {QUESTIONS.map((q, i) => (<li key={q.id}><span className="muted small">{i + 1}. {q.prompt}</span><strong>{q.options.find((o) => o.value === (DEMO_ANSWERS as unknown as Record<string, string>)[q.id])?.label}</strong></li>))}
              </ul>
              {!ran ? <div><button type="button" className="btn btn-primary btn-lg" onClick={() => setRan(true)}>See My Family Results</button></div> : result && (
                <div className="card stack stack-lg" aria-live="polite">
                  <div className="result-hero"><ScoreRing score={result.score} status={result.status} statusKey={result.statusKey} size={190} />
                    <div className="stack"><span className="pill pill-warn" style={{ alignSelf: 'flex-start' }}>{result.status} · {result.score}/100</span><p>{result.summary}</p></div></div>
                  <div className="grid grid-2">{result.categories.map((c) => <CategoryScoreBar key={c.id} c={c} />)}</div>
                  <p className="xs muted">Every point is explained in “How this was calculated” on the <Link to="/results">results page</Link>.</p>
                </div>
              )}
            </div>
          )}

          {step === 4 && result && (
            <div className="stack stack-lg">
              <p className="lede">Reported signals → connected pattern → explanation → suggested action → family confirmation.</p>
              <ol className="action-list">{result.recommendations.slice(0, 3).map((r, i) => (
                <li key={r.id} className="card stack"><div className="row" style={{ alignItems: 'flex-start' }}><span className="step-num" aria-hidden>{i + 1}</span><div className="stack stack-sm"><h2 style={{ fontSize: 'var(--fs-lg)' }}>{r.title}</h2><p>{r.action}</p><span className="pill pill-info" style={{ alignSelf: 'flex-start' }}>{r.minutes} min</span></div></div><ExplainabilityPanel rec={r} defaultOpen={i === 0} /></li>))}</ol>
            </div>
          )}

          {step === 5 && (
            <div className="stack stack-lg">
              <p className="lede">At most two small actions a day, each with a reason, all editable.</p>
              {!planned ? <div><button type="button" className="btn btn-primary btn-lg" onClick={() => { regeneratePlan(); setPlanned(true); }}>Generate My Weekly Plan</button></div> : (
                <ol className="mini-plan card" aria-live="polite">
                  {(plan?.actions ?? []).map((a) => (<li key={a.id}><b>{DAY_NAMES[a.day].slice(0, 3)}</b><span>{a.title}<br /><span className="xs muted">{a.reason}</span></span><span className="muted xs">{a.minutes} min</span></li>))}
                </ol>
              )}
              {planned && <Link to="/plan" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>Open the editable plan</Link>}
            </div>
          )}

          {step === 6 && (
            <div className="stack stack-lg">
              <p className="lede">The optimizer proposes. The family decides. Select changes, review why, then confirm.</p>
              <OptimizationComparison autoOpen />
            </div>
          )}

          {step === 7 && result && (
            <div className="stack stack-lg">
              <ul className="tick-list"><li>FamilyMind AI does not diagnose medical or mental-health conditions.</li><li>It cannot monitor emergencies.</li><li>Private entries are not automatically shared with the household.</li><li>Recommendations are suggestions that the family reviews and controls.</li></ul>
              <PrivacyMatrix />
              <div className="card stack"><h2 style={{ fontSize: 'var(--fs-xl)' }}>Why did I receive this?</h2><WhyPanel recs={result.recommendations} /></div>
            </div>
          )}

          {step === 8 && (
            <div className="stack stack-lg">
              <p className="lede">Demo Household Outcome · Illustrative Result. Prototype outputs, not clinical outcomes.</p>
              {!outcome.any && <div className="notice notice-safety" role="status"><span>No schedule changes have been applied yet. <button type="button" className="linklike" onClick={() => go(6)}>Go back to step 6</button> to review and apply them.</span></div>}
              <ul className="impact-grid">
                <li className="card impact-tile"><span className="impact-num num">{outcome.rebalanced}</span><span>responsibilit{outcome.rebalanced === 1 ? 'y' : 'ies'} rebalanced</span></li>
                <li className="card impact-tile"><span className="impact-num num">{outcome.study}</span><span>protected study block{outcome.study === 1 ? '' : 's'} created</span></li>
                <li className="card impact-tile"><span className="impact-num num">{outcome.backups}</span><span>backup care reminder assigned</span></li>
                <li className="card impact-tile"><span className="impact-num num">{outcome.family}</span><span>minutes of family time planned</span></li>
                <li className="card impact-tile"><span className="impact-num num">{result?.recommendations.length ?? 0}</span><span>recommendations explained</span></li>
              </ul>
              <div className="insight card card-dark"><p className="insight-text">FamilyMind AI does not replace the family’s judgment. It helps the family see, decide, and act together.</p></div>
              <div className="cluster" style={{ gap: 12 }}>
                <Link to="/dashboard" className="btn btn-primary btn-lg">Open the family dashboard</Link>
                <button type="button" className="btn btn-secondary btn-lg" onClick={restart}><RotateCcw size={18} aria-hidden /> Start over</button>
              </div>
            </div>
          )}

          {step > 0 && (
            <div className="between row wrap-row demo-nav">
              <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}><ArrowLeft size={18} aria-hidden /> Back</button>
              {step < 8 ? <button type="button" className="btn btn-royal" onClick={() => go(step + 1)}>Next: {DEMO_STEPS[step].short} <ArrowRight size={18} aria-hidden /></button> : <button type="button" className="btn btn-ghost" onClick={() => nav('/')}>Back to home</button>}
            </div>
          )}
        </section>
      </div>

      <Modal open={confirmReplace} alert title="Replace your data with the demo?" description="Your own household data on this device will be replaced by the Al Noor demo data." onClose={() => setConfirmReplace(false)}
        footer={<><button type="button" data-autofocus className="btn btn-ghost" onClick={() => setConfirmReplace(false)}>Cancel</button><button type="button" className="btn btn-danger" onClick={begin}>Replace and begin</button></>}><span /></Modal>
    </div>
  );
}
