import { t, useLanguage } from '@/i18n';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Calculator, Check, Clock, ListPlus, MessageCircleHeart, RotateCcw, Sprout, TriangleAlert } from 'lucide-react';
import type { AssessmentRecord, AssessmentResult } from '@/types';
import { CategoryScoreBar, ScoreRing } from '@/components/shared/Charts';
import { Disclosure, ExplainabilityPanel, SafetyNotice } from '@/components/shared/Common';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { checkSafety, CRISIS_MESSAGE } from '@/lib/safety';

const STATUS_PILL: Record<string, string> = { strong: 'pill pill-ok', stable: 'pill pill-info', attention: 'pill pill-warn', priority: 'pill pill-danger' };

export function ResultView({ result, record, showActions = true }: { result: AssessmentResult; record: AssessmentRecord; showActions?: boolean }) {
  useLanguage();
  const { regeneratePlan, addCoachActions } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [added, setAdded] = useState<string[]>([]);
  const top = result.recommendations.slice(0, 3);
  const more = result.recommendations.slice(3);
  const crisis = checkSafety(record.answers.note).level === 'crisis';

  const addRec = (id: string) => {
    const rec = result.recommendations.find((r) => r.id === id);
    if (!rec) return;
    const r = addCoachActions(rec.plan);
    setAdded((a) => [...a, id]);
    toast(r.added ? `Added ${r.added} action${r.added === 1 ? '' : 's'} to the Family Plan.` : 'Already in your Family Plan.', r.added ? 'ok' : 'warn');
  };

  return (
    <div className="stack stack-lg">
      <p className="sr-only" role="status" aria-live="polite">{t("Your Household Harmony Score is ")}{result.score}{t(" out of 100. Status: ")}{result.status}.</p>
      {crisis && <SafetyNotice tone="danger" title={t("Please read this.")}>{CRISIS_MESSAGE}</SafetyNotice>}

      <section className="card result-hero" aria-labelledby="score-h">
        <ScoreRing score={result.score} status={result.status} statusKey={result.statusKey} size={200} />
        <div className="stack" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Household Harmony Score")}</span>
          <h2 id="score-h" style={{ fontSize: 'var(--fs-2xl)' }}>{result.status}</h2>
          <span className={STATUS_PILL[result.statusKey]} style={{ alignSelf: 'flex-start' }}>{result.status} · {result.score}/100</span>
          <p>{result.summary}</p>
        </div>
      </section>

      <section className="stack" aria-labelledby="cat-h">
        <h2 id="cat-h" style={{ fontSize: 'var(--fs-xl)' }}>{t("Five areas")}</h2>
        <div className="card grid grid-2" style={{ gap: 'var(--s5)' }}>{result.categories.map((c) => <CategoryScoreBar key={c.id} c={c} />)}</div>
      </section>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="str-h">
          <h2 id="str-h" className="card-title"><span className="card-icon teal"><Sprout size={20} aria-hidden /></span>{t(" Family strengths")}</h2>
          <ul className="stack stack-sm" style={{ listStyle: 'none' }}>
            {result.strengths.map((s) => (<li key={s.id} className="row" style={{ alignItems: 'flex-start' }}><Check size={18} aria-hidden style={{ color: 'var(--success-ink)', marginTop: 4, flex: 'none' }} /><span><strong>{t(s.label)}.</strong> <span className="muted small">{s.detail}</span></span></li>))}
          </ul>
        </section>
        <section className="card stack" aria-labelledby="sig-h">
          <h2 id="sig-h" className="card-title"><span className="card-icon gold"><TriangleAlert size={20} aria-hidden /></span>{t(" Reported signals needing attention")}</h2>
          {result.signals.length === 0 ? <p className="muted">{t("No signals were reported. Keep doing what works.")}</p> : (
            <ul className="stack stack-sm" style={{ listStyle: 'none' }}>
              {result.signals.map((s) => (<li key={s.id}><span className={s.severity === 'attention' ? 'pill pill-warn' : 'pill'}>{s.severity === 'attention' ? t("Needs attention") : t("Worth watching")}</span> <strong>{t(s.label)}.</strong> <span className="muted small">{s.detail}</span></li>))}
            </ul>
          )}
        </section>
      </div>

      <section className="stack" aria-labelledby="act-h">
        <div className="stack stack-sm"><h2 id="act-h" style={{ fontSize: 'var(--fs-xl)' }}>{t("Three prioritized actions")}</h2><p className="muted small">{t("Suggestions for the family to review. You decide what to keep.")}</p></div>
        <ol className="action-list">
          {top.map((r, i) => (
            <li key={r.id} className="card action-card stack">
              <div className="between row" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}><span className="step-num" aria-hidden>{i + 1}</span>
                  <div className="stack stack-sm"><h3>{r.title}</h3><p>{r.action}</p></div></div>
                <span className="pill pill-info" style={{ flex: 'none' }}><Clock size={14} aria-hidden /> {r.minutes}{t(" min")}</span>
              </div>
              <p className="small"><strong>{t("Expected practical benefit:")}</strong> {r.benefit}</p>
              <ExplainabilityPanel rec={r} />
              {showActions && (
                <div className="cluster">
                  <button type="button" className="btn btn-royal btn-sm" onClick={() => addRec(r.id)} disabled={added.includes(r.id)}><ListPlus size={16} aria-hidden /> {added.includes(r.id) ? t("Added to Family Plan") : t("Add to Family Plan")}</button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {more.length > 0 && (
          <Disclosure title={`${more.length} more suggestion${more.length === 1 ? '' : 's'}`}>
            <ul className="stack">{more.map((r) => (<li key={r.id} className="stack stack-sm"><strong>{r.title}</strong><span className="small">{r.action}</span><ExplainabilityPanel rec={r} /></li>))}</ul>
          </Disclosure>
        )}
      </section>

      <Disclosure title={<span className="row"><Calculator size={18} aria-hidden />{t(" How this was calculated")}</span>}>
        <div className="stack">
          <p className="small">{t("The score starts at 100. Each reported answer subtracts a fixed number of points, and the total is limited to 0–100. There is no hidden weighting and no randomness.")}</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t("Score deductions table (scrollable)")}>
            <table>
              <caption className="sr-only">{t("Score deductions")}</caption>
              <thead><tr><th scope="col">{t("Area")}</th><th scope="col">{t("Your answer")}</th><th scope="col">{t("Points deducted")}</th></tr></thead>
              <tbody>
                {result.deductions.map((d) => (<tr key={d.key}><th scope="row">{d.question}</th><td>{d.answerLabel}</td><td className="num">−{d.points}</td></tr>))}
                <tr><th scope="row">{t("Result")}</th><td>100 − {result.deductions.reduce((s, d) => s + d.points, 0)}</td><td className="num strong">{result.score}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="xs muted">{t("Status bands: 80–100 Strong Foundation · 60–79 Stable with Opportunities · 40–59 Needs Attention · 0–39 Priority Support. The score is a prioritization aid, not a medical result or a judgment about your family.")}</p>
        </div>
      </Disclosure>

      {showActions && (
        <div className="cluster" style={{ gap: 12 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => { regeneratePlan(); nav('/plan'); }}>{t("Generate Weekly Plan ")}<ArrowRight size={18} aria-hidden /></button>
          <Link to="/coach" className="btn btn-royal btn-lg"><MessageCircleHeart size={18} aria-hidden />{t(" Ask Family Coach")}</Link>
          <Link to="/assessment" className="btn btn-secondary btn-lg" onClick={() => undefined}><RotateCcw size={18} aria-hidden />{t(" Retake Assessment")}</Link>
        </div>
      )}
      <SafetyNotice />
    </div>
  );
}
