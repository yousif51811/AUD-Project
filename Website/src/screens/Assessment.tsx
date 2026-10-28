import { t, useLanguage } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { AssessmentAnswers, GoalId, PartialAnswers } from '@/types';
import { GOALS, QUESTIONS } from '@/data/copy';
import { DEMO_ANSWERS } from '@/data/demo';
import { useApp } from '@/state/store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ChoiceCard, PageHeader, SafetyNotice } from '@/components/shared/Common';
import { isComplete } from '@/lib/scoring';
import { checkSafety, CRISIS_MESSAGE } from '@/lib/safety';
import { sanitizeText } from '@/lib/sanitize';

const NOTE_MAX = 200;

export default function Assessment() {
  useLanguage();
  useDocumentTitle('Family check-in');
  const { draft, setDraft, submitAssessment, assessment, profile } = useApp();
  const nav = useNavigate();
  const total = QUESTIONS.length;
  const answers: PartialAnswers = draft;
  const firstUnanswered = QUESTIONS.findIndex((q) => !answers[q.id]);
  const [idx, setIdx] = useState(() => (firstUnanswered === -1 ? 0 : Math.min(firstUnanswered, total - 1)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    headRef.current?.focus();
  }, [idx]);

  const isFinal = idx === total; // optional goals + note + review
  const q = QUESTIONS[idx];
  const note = answers.note ?? '';
  const noteSafety = checkSafety(note);

  const set = (patch: PartialAnswers) => setDraft({ ...answers, ...patch });

  const next = () => {
    if (q && !answers[q.id]) { setError('Please choose an answer to continue. Your other answers are saved.'); return; }
    setError('');
    setIdx((i) => i + 1);
  };
  const back = () => { setError(''); setIdx((i) => Math.max(0, i - 1)); };

  const submit = () => {
    const missing = QUESTIONS.findIndex((x) => !answers[x.id]);
    if (missing !== -1) { setError(`Question ${missing + 1} still needs an answer.`); setIdx(missing); return; }
    if (!isComplete(answers)) { setError('Some answers are missing.'); return; }
    if (busy) return;
    setBusy(true);
    const full: AssessmentAnswers = { ...answers, goals: answers.goals ?? [], note: sanitizeText(note, NOTE_MAX) };
    const isDemoAnswers = QUESTIONS.every((x) => (full as unknown as Record<string, unknown>)[x.id] === (DEMO_ANSWERS as unknown as Record<string, unknown>)[x.id]);
    submitAssessment({ answers: full, completed: true, source: profile?.isDemo && isDemoAnswers ? 'demo' : 'user' });
    nav('/results');
  };

  const fillDemo = () => { setDraft({ ...DEMO_ANSWERS, goals: [...DEMO_ANSWERS.goals] }); setError(''); setIdx(total); };

  return (
    <div className="container container-narrow section-tight stack stack-lg">
      <PageHeader eyebrow={t("Family check-in")} title={t("Family check-in")} lede={t("Eight short questions about this week. There are no right answers, and nothing is shared without your say.")} actions={<button type="button" className="btn btn-secondary btn-sm" onClick={fillDemo}><Sparkles size={16} aria-hidden />{t(" Fill with Al Noor demo answers")}</button>} />
      {assessment && <p className="notice" role="note"><span>{t("You already have a result from an earlier check-in. Finishing this one replaces it. ")}<Link to="/results">{t("View current result")}</Link></span></p>}

      <div className="stack stack-sm">
        <div className="between row"><span className="strong" aria-live="polite">{isFinal ? t("Final step: review") : t('Question {current} of {total}', {current: idx + 1, total})}</span><span className="xs muted">{Math.round((Math.min(idx, total) / total) * 100)}{t("% complete")}</span></div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(idx, total)} aria-label={t("Assessment progress")}><span style={{ width: `${(Math.min(idx, total) / total) * 100}%` }} /></div>
      </div>

      <form className="card stack stack-lg" onSubmit={(e) => { e.preventDefault(); if (isFinal) submit(); else next(); }} noValidate aria-labelledby="q-title">
        {!isFinal && q && (
          <fieldset className="stack" aria-describedby={`${q.id}-help${error ? ' q-err' : ''}`}>
            <legend className="sr-only">{t("Question ")}{idx + 1}</legend>
            <h2 id="q-title" tabIndex={-1} ref={headRef} style={{ fontSize: 'var(--fs-xl)' }}>{t(q.prompt)}</h2>
            <p id={`${q.id}-help`} className="muted small">{t(q.help)}</p>
            <div className="choices" role="radiogroup" aria-labelledby="q-title">
              {q.options.map((o) => (
                <ChoiceCard key={o.value} name={q.id} value={o.value} label={o.label} hint={o.hint} checked={(answers as Record<string, unknown>)[q.id] === o.value}
                  onChange={() => { set({ [q.id]: o.value } as PartialAnswers); setError(''); }} />
              ))}
            </div>
          </fieldset>
        )}

        {isFinal && (
          <div className="stack stack-lg">
            <div className="stack stack-sm">
              <h2 id="q-title" tabIndex={-1} ref={headRef} style={{ fontSize: 'var(--fs-xl)' }}>{t("Almost done. Anything to add?")}</h2>
              <p className="muted small">{t("Both fields are optional.")}</p>
            </div>
            <fieldset><legend className="label">{t("Family goals for this week")}</legend>
              <div className="choices" style={{ marginTop: 8 }}>
                {GOALS.map((g) => <ChoiceCard key={g.id} type="checkbox" name="goals" value={g.id} label={g.label} checked={(answers.goals ?? []).includes(g.id)} onChange={(c) => set({ goals: c ? [...(answers.goals ?? []), g.id as GoalId] : (answers.goals ?? []).filter((x) => x !== g.id) })} />)}
              </div>
            </fieldset>
            <div className="field">
              <label className="label" htmlFor="note">{t("What would make this week feel better?")}</label>
              <textarea id="note" className="textarea" maxLength={NOTE_MAX} value={note} onChange={(e) => set({ note: e.target.value })} aria-describedby="note-h note-c" />
              <div className="between row"><span id="note-h" className="hint">{t("This stays on your device and is not shared with the household.")}</span><span id="note-c" className="counter num" aria-live="polite">{note.length}/{NOTE_MAX}</span></div>
            </div>
            {noteSafety.level === 'crisis' && <SafetyNotice tone="danger" title={t("Please read this.")}>{CRISIS_MESSAGE}</SafetyNotice>}
            <div className="card card-tint stack stack-sm">
              <h3>{t("Your answers")}</h3>
              <ul className="review-list">
                {QUESTIONS.map((x, i) => (
                  <li key={x.id}><span className="muted small">{i + 1}. {t(x.prompt)}</span><span className="row between"><strong>{x.options.find((o) => o.value === (answers as Record<string, unknown>)[x.id])?.label ?? 'Not answered'}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={() => setIdx(i)}>{t("Change")}</button></span></li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {error && <p id="q-err" role="alert" className="error-text"><AlertCircle size={16} aria-hidden /> {t(error)}</p>}

        <div className="between row wrap-row">
          <button type="button" className="btn btn-ghost" onClick={back} disabled={idx === 0}><ArrowLeft size={18} aria-hidden />{t(" Back")}</button>
          {isFinal
            ? <button type="submit" className="btn btn-primary btn-lg" disabled={busy} aria-busy={busy}>{busy ? <span className="spinner" aria-hidden /> : null}{t(" See My Family Results")}</button>
            : <button type="submit" className="btn btn-royal">{idx === total - 1 ? t("Review and finish") : t("Next question")} <ArrowRight size={18} aria-hidden /></button>}
        </div>
      </form>
      <SafetyNotice />
    </div>
  );
}
