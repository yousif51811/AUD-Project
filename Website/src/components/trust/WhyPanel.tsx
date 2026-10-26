import { useState } from 'react';
import type { Recommendation } from '@/types';

export const RULES: Record<Recommendation['kind'], string> = {
  study: 'IF student pressure is moderate or higher THEN protect one study block before 8 PM and propose moving one nonurgent chore. Priority rises when pressure is high or severe and sleep is not steady.',
  checkin: 'IF intentional family time is below four times a week OR conversations are not easy to start THEN suggest a 10-minute structured check-in.',
  care: 'IF an older family member needs routine support AND a routine was missed THEN suggest an agreed backup person for required reminders.',
  balance: 'IF household responsibilities are anything other than fair THEN suggest sharing one planning task and a weekly balance reset.',
  window: 'IF family time is limited, stress is high, or quality time is a chosen goal THEN use an existing shared free window for 30 minutes together.',
  rest: 'IF sleep is not good AND no student is under pressure THEN suggest one protected wind-down evening.',
  reflect: 'ALWAYS include a short weekly reflection so the plan can adapt.',
};

/** Interactive “Why did I receive this?” explainer, driven by the real recommendation engine output. */
export function WhyPanel({ recs, rules = RULES, defaultId }: { recs: Recommendation[]; rules?: Record<Recommendation['kind'], string>; defaultId?: string }) {
  const [pick, setPick] = useState(defaultId ?? recs[0]?.id ?? '');
  const rec = recs.find((r) => r.id === pick) ?? recs[0];
  if (!rec) return <p className="muted">No recommendations to explain yet.</p>;
  return (
    <div className="stack stack-lg">
      <div className="field" style={{ maxWidth: 520 }}>
        <label className="label" htmlFor="why-sel">Recommendation</label>
        <select id="why-sel" className="select" value={rec.id} onChange={(e) => setPick(e.target.value)}>
          {recs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
      </div>
      <div className="why-grid" aria-live="polite">
        <div className="card card-tint stack stack-sm"><h3>Input factors</h3><ul className="tick-list">{rec.signals.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div className="card card-tint stack stack-sm"><h3>Rule logic</h3><p className="small">{rules[rec.kind]}</p></div>
        <div className="card card-tint stack stack-sm"><h3>Suggested action</h3><p className="small">{rec.action}</p><p className="xs muted">About {rec.minutes} minutes.</p></div>
        <div className="card card-tint stack stack-sm"><h3>Your control</h3><p className="small">{rec.control}</p></div>
        <div className="card card-tint stack stack-sm"><h3>Alternative action</h3><p className="small">{rec.alternative}</p></div>
        <div className="card card-tint stack stack-sm"><h3>Plain-language explanation</h3><p className="small">{rec.why}</p></div>
      </div>
    </div>
  );
}
