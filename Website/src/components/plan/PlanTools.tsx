import { t, useLanguage } from '@/i18n';
import { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import type { DayIndex, PlanAction, PlanCategory } from '@/types';
import { useApp } from '@/state/store';
import { Modal } from '@/components/shared/Modal';
import { ChoiceCard } from '@/components/shared/Common';
import { ALTERNATES } from '@/lib/plan';
import { DAY_NAMES } from '@/lib/time';
import { validateAction, CATEGORY_LABELS as CAT_LABEL } from '@/lib/actions';
import { sanitizeText, uid } from '@/lib/sanitize';

export function PrintPlan({ plan, name }: { plan: PlanAction[]; name: string }) {
  useLanguage();
  return (
    <div className="print-only">
      <h1>{name}{t(": weekly family plan")}</h1>
      <table><thead><tr><th>{t("Day")}</th><th>{t("Action")}</th><th>{t("Time")}</th><th>{t("Why")}</th><th>{t("Done")}</th></tr></thead>
        <tbody>{plan.map((a) => (<tr key={a.id}><td>{t(DAY_NAMES[a.day])}</td><td>{a.title}</td><td>{a.minutes}{t(" min")}</td><td>{a.reason}</td><td>{a.done ? t("Yes") : '☐'}</td></tr>))}</tbody></table>
      <p>{t("FamilyMind AI is a non-medical wellbeing aid. The family reviews and controls every suggestion.")}</p>
    </div>
  );
}

export function EditDialog({ target, onClose, onSave, onDelete }: { target: PlanAction | 'new'; onClose: () => void; onSave: (a: PlanAction, isNew: boolean) => void; onDelete: (id: string) => void }) {
  useLanguage();
  const { plan, profile, today } = useApp();
  const isNew = target === 'new';
  const base: PlanAction = isNew ? { id: uid('plan'), day: today, title: '', reason: '', participantIds: [], minutes: 10, done: false, category: 'connection', source: 'user' } : target;
  const [title, setTitle] = useState(base.title);
  const [day, setDay] = useState<DayIndex>(base.day);
  const [minutes, setMinutes] = useState(String(base.minutes));
  const [reason, setReason] = useState(base.reason);
  const [who, setWho] = useState<string[]>(base.participantIds);
  const [cat, setCat] = useState<PlanCategory>(base.category);
  const [errs, setErrs] = useState<string[]>([]);
  const members = profile?.members ?? [];

  const save = () => {
    const t = sanitizeText(title, 100);
    const m = Number(minutes);
    const e = validateAction({ ...base, title: t, minutes: m, day }, plan, profile?.preferences.maxDailyMinutes ?? 90);
    setErrs(e);
    if (e.length) return;
    onSave({ ...base, title: t, day, minutes: m, reason: sanitizeText(reason, 240) || 'Added by the family.', participantIds: who, category: cat, source: 'user' }, isNew);
  };
  return (
    <Modal open title={isNew ? t("Add an action") : t("Edit action")} onClose={onClose} wide
      footer={<>{!isNew && <button type="button" className="btn btn-ghost" style={{ marginInlineEnd: 'auto', color: 'var(--red-ink)' }} onClick={() => onDelete(base.id)}><Trash2 size={16} aria-hidden />{t(" Remove")}</button>}<button type="button" className="btn btn-ghost" onClick={onClose}>{t("Cancel")}</button><button type="button" className="btn btn-royal" onClick={save}>{t("Save action")}</button></>}>
      {errs.length > 0 && <div className="error-summary" role="alert"><AlertCircle size={16} aria-hidden /> <ul>{errs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div className="field"><label className="label" htmlFor="pa-t">{t("Title")}</label><input id="pa-t" data-autofocus className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid grid-3">
        <div className="field"><label className="label" htmlFor="pa-d">{t("Day")}</label><select id="pa-d" className="select" value={day} onChange={(e) => setDay(Number(e.target.value) as DayIndex)}>{DAY_NAMES.map((n, i) => <option key={n} value={i}>{t(n)}</option>)}</select></div>
        <div className="field"><label className="label" htmlFor="pa-m">{t("Minutes")}</label><input id="pa-m" className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} /></div>
        <div className="field"><label className="label" htmlFor="pa-c">{t("Type")}</label><select id="pa-c" className="select" value={cat} onChange={(e) => setCat(e.target.value as PlanCategory)}>{(Object.keys(ALTERNATES) as PlanCategory[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></div>
      </div>
      <div className="field"><label className="label" htmlFor="pa-r">{t("Why this action")}</label><textarea id="pa-r" className="textarea" rows={2} maxLength={240} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {members.length > 0 && <fieldset><legend className="label">{t("Who takes part")}</legend><div className="choices" style={{ marginTop: 8 }}>{members.map((m) => <ChoiceCard key={m.id} type="checkbox" name="pa-who" value={m.id} label={m.name} checked={who.includes(m.id)} onChange={(c) => setWho((x) => (c ? [...x, m.id] : x.filter((y) => y !== m.id)))} />)}</div></fieldset>}
    </Modal>
  );
}

