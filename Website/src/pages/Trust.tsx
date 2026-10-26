import { useMemo, useState } from 'react';
import { Trash2, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader, SafetyNotice, SectionHeading } from '@/components/shared/Common';
import { Modal } from '@/components/shared/Modal';
import { analyze } from '@/lib/recommendations';
import { DEMO_ANSWERS, demoProfile, demoSchedule } from '@/data/demo';
import { PrivacyMatrix } from '@/components/trust/PrivacyMatrix';
import { RULES, WhyPanel } from '@/components/trust/WhyPanel';

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  { id: 'can', title: 'What FamilyMind AI can do', body: ['Connect the signals your family chooses to share into one picture.', 'Explain, in plain language, why something needs attention.', 'Suggest small, realistic actions and turn them into an editable plan.', 'Propose schedule changes that the family can review, apply, and undo.'] },
  { id: 'cannot', title: 'What it cannot do', body: ['FamilyMind AI does not diagnose medical or mental-health conditions.', 'It cannot monitor emergencies.', 'It does not replace doctors, counsellors, teachers or other qualified professionals.', 'It cannot predict or prevent every family crisis.'] },
  { id: 'minimize', title: 'Data minimization', body: ['Only the answers needed to produce the score and suggestions are stored.', 'There are no accounts, no tracking, and no camera, microphone or location access.', 'Free-text notes are limited in length and stay on the device.'] },
  { id: 'consent', title: 'Consent and visibility', body: ['Private entries are not automatically shared with the household.', 'Each member decides which summaries are shared, and can switch sharing off at any time.', 'Nobody can secretly view another member’s journal, exact mood, personal messages or confidential information.'] },
  { id: 'youth', title: 'Child and teenager safeguards', body: ['Teenagers control what the household sees from their Student Support space.', 'Language is respectful, never childish or shaming.', 'Routines for children are suggestions for families, not surveillance.'] },
  { id: 'explain', title: 'Explainable recommendations', body: ['Recommendations are suggestions that the family reviews and controls.', 'Every one shows the signal, the pattern, the reason, who decides, the time needed, and an alternative.', 'Scoring is a fixed, published deduction table with no hidden weights or randomness.'] },
  { id: 'control', title: 'Family control', body: ['Nothing changes automatically. The schedule optimizer proposes; you select and confirm.', 'Every applied schedule change can be undone.', 'Plans can be edited, replaced, reduced or reset.'] },
  { id: 'local', title: 'Local prototype data', body: ['Everything is saved in this browser only, under familymind:v1 keys.', 'Prototype metrics demonstrate interface behavior and are not clinical outcomes.', 'The demo family (Al Noor) is fictional.'] },
  { id: 'limits', title: 'Limitations', body: ['The prototype uses deterministic rules, which are transparent but simplified.', 'Scores are a prioritization aid, not a judgment about your family.', 'Self-reported answers may be incomplete or change from day to day.'] },
  { id: 'crisis', title: 'Crisis boundary', body: ['If a message includes emergency or crisis language, the coach stops ordinary coaching.', 'It states plainly that it cannot monitor emergencies and encourages contacting local emergency services, a trusted adult, or a qualified professional.', 'It never invents hotline numbers.'] },
  { id: 'culture', title: 'Cultural respect', body: ['Suggestions are optional and designed to fit many family structures, including multi-generational households.', 'Activities and routines are chosen by the family.', 'Respect for elders and shared responsibility are treated as strengths.'] },
  { id: 'bias', title: 'Bias awareness', body: ['Rules avoid assumptions about who “should” do which tasks.', 'No individual is blamed. Patterns are described at household level.', 'A real deployment would need review with diverse families and independent experts.'] },
];

export default function Trust() {
  useDocumentTitle('Trust & Safety');
  const sections = SECTIONS.map((s) => (s.id === 'consent' ? { ...s, title: 'Sharing preferences in this prototype', body: ['Sharing controls demonstrate intended visibility settings in one shared browser.', 'There are no member accounts or access restrictions. Anyone using this browser can open all modules.', 'Use fictional information when exploring. Member-level privacy would require a different implementation.'] } : s.id === 'youth' ? { ...s, body: ['Student controls demonstrate sharing preferences, rather than preventing access to the Student Support page.', 'Language is respectful, never childish or shaming.', 'Routines for children are suggestions for families, not surveillance.'] } : s));
  const { result, restoreDemo, clearData, profile } = useApp();
  const { toast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const recs = useMemo(() => result?.recommendations ?? analyze(DEMO_ANSWERS, demoProfile(), demoSchedule()).recommendations, [result]);

  return (
    <div className="container section-tight stack stack-lg">
      <PageHeader eyebrow="Trust Center" title="A few things worth knowing." lede="FamilyMind AI is built so families can see why something is suggested, and stay in charge of what happens next." />
      <div className="grid grid-2 trust-pledge">
        <SafetyNotice tone="danger" title="Crisis boundary.">FamilyMind AI does not diagnose medical or mental-health conditions. It cannot monitor emergencies. In an emergency, contact local emergency services, a trusted adult, or a qualified professional.</SafetyNotice>
        <SafetyNotice tone="info" title="Family control.">{('This is a shared browser workspace. Visibility settings are demonstrative, not member access controls. The family reviews all suggestions.')}</SafetyNotice>
      </div>

      <div className="trust-topics">
        {sections.map((s, i) => (
          <details key={s.id} id={s.id} className="trust-topic">
            <summary><span className="trust-topic-number" aria-hidden>{String(i+1).padStart(2,'0')}</span><span>{s.title}</span><span aria-hidden>+</span></summary>
            <ul className="tick-list">{s.body.map((b) => <li key={b}>{b}</li>)}</ul>
          </details>
        ))}
      </div>

      <section className="stack stack-lg" aria-labelledby="matrix-h">
        <SectionHeading id="matrix-h" eyebrow="Privacy matrix" title={("Intended sharing model")} lede={("The table describes the intended product model. This single-browser prototype does not enforce separation between members.")} />
        <PrivacyMatrix />
      </section>

      <section className="card stack stack-lg" aria-labelledby="why-h">
        <SectionHeading id="why-h" eyebrow="Interactive example" title="Why did I receive this?" lede="Choose a recommendation to see the inputs, the rule, your control, and an alternative." />
        <WhyPanel recs={recs} rules={RULES} />
      </section>

      <section className="card stack stack-lg" aria-labelledby="reset-h">
        <SectionHeading id="reset-h" eyebrow="Reset and deletion" title="Your data, your controls" lede={profile?.isDemo ? 'You are viewing the fictional Al Noor demo family.' : 'Your household data lives only on this device.'} />
        <div className="cluster" style={{ gap: 12 }}>
          <button type="button" className="btn btn-royal" onClick={() => { restoreDemo(); toast('Al Noor demo restored to its starting state.'); }}><Sparkles size={18} aria-hidden /> Restore Al Noor Demo</button>
          <button type="button" className="btn btn-secondary" onClick={() => { restoreDemo(); toast('Demo data reset.'); }}><RotateCcw size={18} aria-hidden /> Reset Demo Data</button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)}><Trash2 size={18} aria-hidden /> Clear Local Data</button>
        </div>
        <p className="xs muted">Clearing removes the household, assessment, plan, schedule, memories and care data from this browser. It cannot be undone.</p>
      </section>

      <Modal open={confirmClear} alert title="Clear all local data?" description="This removes everything FamilyMind AI stored in this browser." onClose={() => setConfirmClear(false)}
        footer={<><button type="button" data-autofocus className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" className="btn btn-danger" onClick={() => { clearData(); setConfirmClear(false); toast('All local data cleared.', 'warn'); }}>Clear Local Data</button></>}><span /></Modal>
    </div>
  );
}
