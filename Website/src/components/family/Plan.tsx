import { t, useLanguage } from '@/i18n';
import { useState } from 'react';
import { Check, Clock, Plus, Printer, SlidersHorizontal, ArrowUpRight, Pencil, Repeat2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { EditDialog, PrintPlan } from '@/components/plan/PlanTools';
import { DAY_NAMES } from '@/lib/time';
import { CATEGORY_LABELS, EMPTY_FILTERS, filterActions, type ActionFilters } from '@/lib/actions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Modal } from '@/components/shared/Modal';
import { alternativesFor, replaceAction, regenerateAction, setReduced } from '@/lib/plan';
import { Switch } from '@/components/shared/Common';
import type { PlanAction } from '@/types';
export function FamilyPlan() {
  useLanguage();
  useDocumentTitle('Your weekly plan');
  const app = useApp(); const { toast } = useToast();
  const [editing, setEditing] = useState<PlanAction | 'new' | null>(null);
  const [replacing, setReplacing] = useState<PlanAction | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [filters, setFilters] = useState<ActionFilters>({ ...EMPTY_FILTERS });
  const actions = app.plan?.actions ?? [];
  const filtered = filterActions(actions, filters);
  const set = <K extends keyof ActionFilters>(key: K, value: ActionFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  return <div className="family-plan stack stack-lg">
    <header className="planner-heading"><div><p className="eyebrow">{t("ONE SHARED PLAN")}</p><h1 tabIndex={-1} data-page-heading>{t("Our week.")}</h1><p className="lede">{t("A little structure for the week. Change anything that doesn’t fit.")}</p></div><button className="btn btn-primary" type="button" onClick={() => setEditing('new')}><Plus size={18} />{t(" Add an action")}</button></header>
    <div className="family-plan-summary"><div><strong>{actions.filter((a) => a.done).length}<span className="muted"> / {actions.length}</span></strong><span className="small muted">{t("actions complete")}</span></div><div><strong>{actions.reduce((n,a) => n + a.minutes,0)} <small>{t("min")}</small></strong><span className="small muted">{t("planned this week")}</span></div><div><strong>{app.profile?.preferences.maxDailyMinutes ?? 90} <small>{t("min/day")}</small></strong><span className="small muted">{t("your daily limit")}</span></div><button type="button" className="btn btn-secondary" onClick={() => window.print()}><Printer size={16} />{t(" Print plan")}</button></div>
    <details className="family-filters" aria-label={t("Plan filters")}><summary>{t("Filter the plan ")}<span>{filtered.length}{t(" of ")}{actions.length}{t(" actions shown")}</span></summary><div className="stack"><div className="between row"><h2 className="card-title"><SlidersHorizontal size={18} />{t(" Show me")}</h2><button className="btn btn-ghost btn-sm" type="button" onClick={() => setFilters({ ...EMPTY_FILTERS })}>{t("Reset filters")}</button></div>
      <div className="family-filter-grid">
        <label className="field">{t("Day")}<select className="select" value={filters.day} onChange={(e) => set('day', e.target.value === 'all' ? 'all' : Number(e.target.value) as ActionFilters['day'])}><option value="all">{t("All days")}</option>{DAY_NAMES.map((d,i) => <option value={i} key={d}>{t(d)}</option>)}</select></label>
        <label className="field">{t("Participant")}<select className="select" value={filters.person} onChange={(e) => set('person',e.target.value)}><option value="all">{t("Everyone")}</option>{app.profile?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="field">{t("Category")}<select className="select" value={filters.category} onChange={(e) => set('category',e.target.value as ActionFilters['category'])}><option value="all">{t("All categories")}</option>{Object.entries(CATEGORY_LABELS).map(([id,label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label>
        <label className="field">{t("Status")}<select className="select" value={filters.status} onChange={(e) => set('status',e.target.value as ActionFilters['status'])}><option value="all">{t("All actions")}</option><option value="open">{t("To do")}</option><option value="done">{t("Completed")}</option></select></label>
      </div><div className="cluster"><span className="small muted">{t("Saved automatically on this browser.")}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)}>{t("Make a new plan")}</button></div><p className="xs muted" role="status">{filtered.length}{t(" of ")}{actions.length}{t(" actions match")}</p>
      {app.plan && <Switch checked={app.plan.reduced} onChange={(v) => app.updatePlan((p) => setReduced(p,v))} label={t("Reduce workload")} description={t("Keep one action per day; pause the rest until you turn this off.")} />}
      {!!app.plan?.parked.length && <p className="small muted">{app.plan.parked.length}{t(" actions paused by Reduce workload.")}</p>}
    </div></details>
    {!actions.length && <div className="family-empty card"><h2>{t("Start with one small thing.")}</h2><p className="muted">{t("Add an action yourself, or build a plan from your check-in.")}</p><div className="cluster"><button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>{t("Add your first action")}</button><button type="button" className="btn btn-secondary" onClick={() => { app.regeneratePlan(); toast('Weekly plan generated.'); }}>{t("Generate a weekly plan")}</button></div><Link to="/assessment">{t("Take the family check-in ")}<ArrowUpRight size={14} /></Link></div>}
    {!!actions.length && !filtered.length && <p className="card">{t("No actions match these filters. Try another combination or reset filters.")}</p>}
    <div className="family-week-list">{DAY_NAMES.map((day,d) => {
      const list = filtered.filter((a) => a.day === d);
      if (filters.day !== 'all' && filters.day !== d) return null;
      if (actions.length && !list.length && (filters.person !== 'all' || filters.category !== 'all' || filters.status !== 'all')) return null;
      return <section key={day} className={`card family-day${d === app.today ? ' is-today' : ''}`} aria-label={t('{day} actions', {day: t(day)})}><div className="week-day-label"><span className="day-initial">{t(day)}</span>{d === app.today && <span className="pill pill-info">{t("Today")}</span>}</div>{!list.length && <p className="small muted">{t("No plans. A little room to breathe.")}</p>}<ul className="family-task-list">{list.map((a) => <li key={a.id} className={a.done ? 'is-done' : ''}>
        <label className="family-task-check"><input type="checkbox" checked={a.done} onChange={() => app.toggleAction(a.id)} aria-label={t('Mark complete: {title}', { title: a.title })} /><span><Check size={14} /></span></label><div className="stack stack-sm"><strong>{a.title}</strong><span className="xs muted"><Clock size={12} /> {a.minutes}{t(" min · ")}{t(CATEGORY_LABELS[a.category])}</span><span className="xs muted">{a.participantIds.map((id) => app.profile?.members.find((m) => m.id === id)?.name).filter(Boolean).join(', ') || 'Family action'}</span><details><summary className="xs">{t("Why this action?")}</summary><p className="small muted">{a.reason}</p></details><div className="cluster"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(a)} aria-label={t('Edit: {title}', { title: a.title })}><Pencil size={13} />{t(" Edit")}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplacing(a)} aria-label={t('Replace: {title}', { title: a.title })}><Repeat2 size={13} />{t(" Replace")}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { app.updatePlan((p) => regenerateAction(p,a.id)); toast('Action regenerated.'); }} aria-label={t('Regenerate: {title}', { title: a.title })}><RefreshCw size={13} />{t(" Refresh idea")}</button></div></div></li>)}</ul></section>;
    })}</div>
    <Modal open={confirmReset} title={t("Make a new weekly plan?")} description={t("This replaces your current actions with suggestions from your check-in. Your manual edits and completion marks will be replaced.")} onClose={() => setConfirmReset(false)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>{t("Keep current plan")}</button><button type="button" className="btn btn-primary" onClick={() => { app.regeneratePlan(); setConfirmReset(false); toast('Plan regenerated.'); }}>{t("Make a new plan")}</button></>}><p>{t("Your household, check-in, and schedule stay saved.")}</p></Modal>
    {replacing && <Modal open title={t("Choose another small step")} onClose={() => setReplacing(null)}><div className="stack">{alternativesFor(replacing).map((alt) => <button type="button" className="btn btn-secondary" key={alt.title} onClick={() => { app.updatePlan((p) => replaceAction(p,replacing.id,alt)); setReplacing(null); toast('Action replaced.'); }}>{alt.title} · {alt.minutes}{t(" min")}</button>)}</div></Modal>}
    <PrintPlan plan={actions} name={app.profile?.name ?? 'Family'} />
    {editing && <EditDialog key={editing === 'new' ? 'new' : editing.id} target={editing} onClose={() => setEditing(null)} onDelete={(id) => { app.deleteAction(id); setEditing(null); toast('Action removed.'); }} onSave={(a,isNew) => { if (isNew) { const errors = app.addQuickAction(a); if (errors.length) { toast(errors.join(' '),'warn'); return; } } else app.editAction(a.id,a); setEditing(null); toast('Action saved on this device.'); }} />}
  </div>;
}
