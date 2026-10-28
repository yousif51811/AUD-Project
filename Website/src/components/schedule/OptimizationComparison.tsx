import { t, useLanguage } from '@/i18n';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, Sparkles, Undo2, X } from 'lucide-react';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { Modal } from '@/components/shared/Modal';
import { ResponsibilityChart } from '@/components/shared/Charts';
import { applyProposals as simulate, detectConflicts, optimizeSchedule, overloadedMembers } from '@/lib/scheduleOptimizer';
import { balanceOf } from '@/lib/people';
import { DAY_SHORT, formatTime } from '@/lib/time';
import type { DayIndex, OptimizationProposal, ScheduleEvent } from '@/types';

function overloadCount(events: ScheduleEvent[]): number {
  let n = 0;
  for (const d of [0, 1, 2, 3, 4, 5, 6] as DayIndex[]) n += overloadedMembers(events, d).length;
  return n;
}

/** Proposed vs current schedule. Nothing is applied without selection and explicit confirmation. */
export function OptimizationComparison({ autoOpen = false, onApplied }: { autoOpen?: boolean; onApplied?: () => void }) {
  useLanguage();
  const { schedule, profile, assessment, today, applyProposals, undoSchedule, canUndoSchedule } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(autoOpen);
  const [rejected, setRejected] = useState(false);
  const proposals = useMemo(() => optimizeSchedule(schedule, profile, assessment?.answers ?? null, today), [schedule, profile, assessment, today]);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const sel = selected ?? proposals.map((p) => p.id);
  const chosen = proposals.filter((p) => sel.includes(p.id));

  const after = useMemo(() => simulate(schedule, chosen), [schedule, chosen]);
  const members = profile?.members ?? [];
  const before = useMemo(() => balanceOf(schedule, members), [schedule, members]);
  const afterBal = useMemo(() => balanceOf(after, members), [after, members]);

  const toggle = (id: string) => setSelected((s) => { const cur = s ?? proposals.map((p) => p.id); return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]; });

  const apply = () => {
    applyProposals(chosen);
    setConfirm(false); setOpen(false); setSelected(null);
    toast(`Applied ${chosen.length} change${chosen.length === 1 ? '' : 's'}.`, 'ok', { label: 'Undo', run: () => { undoSchedule(); toast('Changes undone.', 'warn'); } });
    onApplied?.();
  };

  const describe = (p: OptimizationProposal) => p.changes.map((c) => {
    if (c.op === 'add') return `Add: ${c.event.title}, ${DAY_SHORT[c.event.day]} ${formatTime(c.event.start)}–${formatTime(c.event.end)}`;
    const e = schedule.find((x) => x.id === c.eventId);
    if (!e) return 'Update event';
    const bits: string[] = [];
    if (c.patch.assigneeIds) bits.push(`assigned to ${c.patch.assigneeIds.map((id) => members.find((m) => m.id === id)?.name ?? '?').join(' & ')}`);
    if (c.patch.start) bits.push(`now ${formatTime(c.patch.start)}–${formatTime(c.patch.end ?? e.end)}`);
    if (c.patch.backupId) bits.push(`backup: ${members.find((m) => m.id === c.patch.backupId)?.name ?? '?'}`);
    return `${e.title} (${DAY_SHORT[e.day]}): ${bits.join(', ')}`;
  });

  return (
    <section className="card stack stack-lg" aria-labelledby="opt-h">
      <div className="between row wrap-row">
        <div className="stack stack-sm"><h2 id="opt-h" style={{ fontSize: 'var(--fs-xl)' }}><Sparkles size={22} aria-hidden style={{ display: 'inline', verticalAlign: '-3px', color: 'var(--teal-ink)' }} />{t(" AI Optimize")}</h2>
          <p className="muted small">{t("The optimizer proposes changes and explains each one. Nothing moves until you select changes and confirm.")}</p></div>
        <div className="cluster">
          {!open && <button type="button" className="btn btn-primary" onClick={() => { setOpen(true); setRejected(false); }} disabled={proposals.length === 0} aria-expanded={open}>{proposals.length === 0 ? t("No changes to suggest") : `Review ${proposals.length} proposed change${proposals.length === 1 ? '' : 's'}`}</button>}
          <button type="button" className="btn btn-secondary" onClick={() => { undoSchedule(); toast('Last change undone.', 'warn'); }} disabled={!canUndoSchedule}><Undo2 size={16} aria-hidden />{t(" Undo last change")}</button>
        </div>
      </div>
      {rejected && !open && <p className="notice" role="status"><span>{t("Proposals set aside. Your schedule is unchanged.")}</span></p>}
      {proposals.length === 0 && !open && <p className="notice" role="status"><span>{t("Your schedule has no suggested changes right now. That is a good sign.")}</span></p>}

      {open && (
        <div className="stack stack-lg" role="region" aria-label={t("Proposed changes")}>
          <ul className="proposal-list">
            {proposals.map((p) => (
              <li key={p.id} className={`proposal card card-flat${sel.includes(p.id) ? ' is-selected' : ''}`}>
                <label className="proposal-head">
                  <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span className="choice-mark proposal-mark"><Check size={14} strokeWidth={3} aria-hidden /></span>
                  <span className="stack stack-sm"><strong>{p.title}</strong><span className="xs muted">{p.detail}</span></span>
                </label>
                <div className="proposal-body stack stack-sm">
                  <div className="compare">
                    <div><span className="xs muted">{t("Current")}</span>{p.changes.map((c, i) => {
                      if (c.op === 'add') return <p key={i} className="small">{t("Nothing scheduled")}</p>;
                      const e = schedule.find((x) => x.id === c.eventId);
                      return <p key={i} className="small">{e ? `${e.title}, ${DAY_SHORT[e.day]} ${formatTime(e.start)}–${formatTime(e.end)} · ${e.assigneeIds.map((id) => members.find((m) => m.id === id)?.name).join(' & ')}` : ''}</p>;
                    }).slice(0, 2)}</div>
                    <ArrowRight size={18} aria-hidden className="compare-arrow" />
                    <div><span className="xs muted">{t("Proposed")}</span>{describe(p).slice(0, 2).map((t, i) => <p key={i} className="small strong">{t}</p>)}</div>
                  </div>
                  <p className="small"><strong>{t("Why:")}</strong> {p.why}</p>
                  <p className="xs muted">{t("Signal: ")}{p.signal}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid grid-2">
            <div className="card card-tint stack"><h3>{t("Responsibility balance: before")}</h3><ResponsibilityChart entries={before} label={t("Balance before")} /></div>
            <div className="card card-tint stack"><h3>{t("Responsibility balance: after")}</h3><ResponsibilityChart entries={afterBal} label={t("Balance after")} /></div>
          </div>
          <ul className="impact-list" aria-label={t("Effect of selected changes")}>
            <li><strong>{detectConflicts(schedule).length}</strong>{t(" conflict")}{detectConflicts(schedule).length === 1 ? '' : t("s")}{t(" now → ")}<strong>{detectConflicts(after).length}</strong>{t(" after")}</li>
            <li><strong>{overloadCount(schedule)}</strong>{t(" overloaded day")}{overloadCount(schedule) === 1 ? '' : t("s")}{t(" now → ")}<strong>{overloadCount(after)}</strong>{t(" after")}</li>
          </ul>

          <div className="cluster" style={{ gap: 12 }}>
            <button type="button" className="btn btn-primary btn-lg" disabled={chosen.length === 0} onClick={() => setConfirm(true)}>{t("Apply ")}{chosen.length}{t(" Selected Change")}{chosen.length === 1 ? '' : t("s")}</button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => { setOpen(false); setRejected(true); }}><X size={18} aria-hidden />{t(" Reject")}</button>
          </div>
        </div>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Apply ${chosen.length} change${chosen.length === 1 ? '' : 's'}?`} description={t("You can undo these changes right after applying.")} alert
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>{t("Go back")}</button><button type="button" data-autofocus className="btn btn-primary" onClick={apply}>{t("Confirm and apply")}</button></>}>
        <ul className="stack stack-sm" style={{ paddingInlineStart: 20 }}>{chosen.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
      </Modal>
    </section>
  );
}
