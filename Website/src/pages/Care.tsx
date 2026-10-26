import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarCheck, Check, Clock, Droplets, Footprints, HeartHandshake, Pill, Phone, BookOpen, ShieldAlert, UserPlus, UsersRound } from 'lucide-react';
import type { CareKind, FamilyMember, Reminder } from '@/types';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EmptyState, MemberAvatar, PageHeader, SafetyNotice, Switch } from '@/components/shared/Common';
import { Modal } from '@/components/shared/Modal';
import { adults, elder } from '@/lib/people';
import { formatTime, fromMin, toMin } from '@/lib/time';
import { sanitizeText } from '@/lib/sanitize';

const ICON: Record<CareKind, typeof Pill> = { medication: Pill, hydration: Droplets, movement: Footprints, call: Phone, appointment: CalendarCheck, story: BookOpen };
const STATUS_TEXT: Record<Reminder['status'], string> = { pending: 'Coming up', confirmed: 'Confirmed', later: 'Reminding later', asked: 'A family member was asked', missed: 'Not confirmed' };
const STATUS_PILL: Record<Reminder['status'], string> = { pending: 'pill', confirmed: 'pill pill-ok', later: 'pill pill-info', asked: 'pill pill-violet', missed: 'pill pill-warn' };

export default function Care() {
  useDocumentTitle('Older adult care');
  const { profile, care, updateReminder, setCare, restoreDemo } = useApp();
  const { toast } = useToast();
  const [askFor, setAskFor] = useState<Reminder | null>(null);
  const [backupFor, setBackupFor] = useState<Reminder | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const el = elder(profile);
  const members = profile?.members ?? [];
  const nm = (id?: string) => members.find((m) => m.id === id)?.name ?? '';

  if (!profile || care.reminders.length === 0) {
    return (<><PageHeader title="Older adult care" /><EmptyState icon={<HeartHandshake size={26} />} title="No care routines yet" message="Care routines appear when an older family member is part of the household. You can also explore the Al Noor demo."
      actions={<><button type="button" className="btn btn-primary" onClick={() => { restoreDemo(); toast('Al Noor demo restored.'); }}>Restore Al Noor demo</button></>} /></>);
  }

  const log = (r: Reminder, line: string) => [...r.log, line];

  const confirm = (r: Reminder) => { updateReminder(r.id, (x) => ({ ...x, status: 'confirmed', log: log(x, `Confirmed${el ? ` by ${el.name}` : ''}. Thank you.`) })); toast(`${r.title} confirmed.`); };
  const later = (r: Reminder) => {
    updateReminder(r.id, (x) => ({ ...x, status: 'later', time: fromMin(Math.min(23 * 60 + 30, toMin(x.time) + 30)), log: log(x, 'Reminder moved 30 minutes later.') }));
    toast('Okay. We will remind again in 30 minutes.');
  };
  const escalate = (r: Reminder) => {
    const canNotify = r.required && !!r.backupId && r.backupAgreed && !!profile.consent.allowBackupNotification;
    updateReminder(r.id, (x) => ({
      ...x, status: 'missed',
      log: [...x.log, 'Stage 1: primary reminder sent, not confirmed.',
        canNotify ? `Stage 2: agreed backup ${nm(x.backupId)} notified.` : `Stage 2 not sent: ${!x.required ? 'this reminder is not marked required' : !x.backupId ? 'no backup assigned' : !x.backupAgreed ? 'backup has not been agreed yet' : 'backup notifications are turned off'}.`],
    }));
    toast(((canNotify ? `Simulation recorded for ${nm(r.backupId)}. No message was sent.` : 'No simulated backup notification: an agreed backup and required reminder are needed.')), canNotify ? 'ok' : 'warn');
  };

  const missed = care.reminders.filter((r) => r.status === 'missed');
  const demoStage = care.reminders.find((r) => r.required);

  return (
    <div className="care-mode stack stack-lg">
      <PageHeader eyebrow={`Older adult care${el ? ` · ${el.name}` : ''}`} title="Looking after each other." lede="Clear reminders, comfortable text and an agreed backup, so routines stay steady and dignity stays intact." />
      <SafetyNotice tone="danger" title="This prototype does not monitor emergencies.">If someone needs urgent help, contact local emergency services or a qualified professional immediately.</SafetyNotice>

      {missed.length > 0 && <div className="notice notice-safety" role="status"><BellRing size={22} aria-hidden /><div><strong>{missed.length} routine not confirmed today.</strong> {missed.map((m) => m.title).join(', ')}. Consider asking a family member or assigning a backup.</div></div>}

      <ul className="care-grid" aria-label="Today's routines">
        {care.reminders.map((r) => {
          const Icon = ICON[r.kind];
          const done = r.status === 'confirmed';
          return (
            <li key={r.id} className={`card care-card status-${r.status}`}>
              <div className="between row" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="card-icon red" aria-hidden><Icon size={26} /></span>
                  <div className="stack stack-sm"><h2 className="care-title">{r.title}</h2><span className="care-time"><Clock size={16} aria-hidden /> {formatTime(r.time)}</span></div>
                </div>
                <span className={STATUS_PILL[r.status]}>{done ? '✓ ' : ''}{STATUS_TEXT[r.status]}</span>
              </div>
              <p>{r.detail}</p>
              <p className="care-backup small">
                <UsersRound size={16} aria-hidden /> {r.backupId ? <>Backup: <strong>{nm(r.backupId)}</strong> {r.backupAgreed ? '(agreed)' : '(waiting for agreement)'}</> : r.required ? 'Required reminder · no backup assigned' : 'Optional reminder'}
                {r.askedId && <> · Asked: <strong>{nm(r.askedId)}</strong></>}
              </p>
              <div className="cluster care-actions">
                <button type="button" className="btn btn-royal" onClick={() => confirm(r)} disabled={done}><Check size={20} aria-hidden /> {done ? 'Confirmed' : 'Confirm'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => later(r)} disabled={done}>Remind Later</button>
                <button type="button" className="btn btn-secondary" onClick={() => setAskFor(r)} disabled={done}>Ask Family Member</button>
                <button type="button" className="btn btn-secondary" onClick={() => setBackupFor(r)}><UserPlus size={18} aria-hidden /> Assign Backup</button>
              </div>
              {r.log.length > 0 && (<details className="care-log"><summary>Reminder history</summary><ol>{r.log.map((l, i) => <li key={i}>{l}</li>)}</ol></details>)}
            </li>
          );
        })}
      </ul>

      {demoStage && (
        <section className="card stack" aria-labelledby="flow-h">
          <h2 id="flow-h" style={{ fontSize: 'var(--fs-xl)' }}>Two-stage reminder</h2>
          <p className="muted">A backup is only notified when it was agreed in advance <em>and</em> the reminder is marked required. Try it with “{demoStage.title}”.</p>
          <ol className="two-stage">
            <li className="stage"><span className="step-num" aria-hidden>1</span><div><strong>Primary reminder</strong><p className="small muted">{el?.name ?? 'The family member'} gets a gentle reminder at {formatTime(demoStage.time)}.</p></div></li>
            <li className={`stage${demoStage.backupId && demoStage.backupAgreed ? '' : ' is-off'}`}><span className="step-num" aria-hidden>2</span><div><strong>Backup notification</strong><p className="small muted">{demoStage.backupId && demoStage.backupAgreed ? `${nm(demoStage.backupId)} is notified only if stage 1 is not confirmed.` : 'Not active. Assign and agree a backup to turn this stage on.'}</p></div></li>
          </ol>
          <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => escalate(demoStage)}>Simulate: reminder not confirmed</button>
        </section>
      )}

      <section className="card stack" aria-labelledby="ec-h">
        <h2 id="ec-h" style={{ fontSize: 'var(--fs-xl)' }}>Emergency contact setup</h2>
        <p className="notice notice-danger"><ShieldAlert size={20} aria-hidden /><span><strong>This prototype does not monitor emergencies.</strong> This is a placeholder for a trusted contact your family agrees on. It never contacts anyone automatically.</span></p>
        {care.emergencyContact ? (
          <div className="between row wrap-row"><p><strong>{care.emergencyContact.name}</strong> · {care.emergencyContact.relationship}{care.emergencyContact.note ? ` · ${care.emergencyContact.note}` : ''}</p>
            <div className="cluster"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setContactOpen(true)}>Edit</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCare((c) => ({ ...c, emergencyContact: null })); toast('Contact removed.', 'warn'); }}>Remove</button></div></div>
        ) : <button type="button" className="btn btn-royal" style={{ alignSelf: 'flex-start' }} onClick={() => setContactOpen(true)}>Add trusted contact</button>}
      </section>
      <p className="xs muted">Want to keep a story? <Link to="/memories">Save it in the Memory Vault</Link>.</p>

      {askFor && <AskDialog r={askFor} people={members.filter((m) => m.id !== el?.id)} onClose={() => setAskFor(null)} onAsk={(id) => { updateReminder(askFor.id, (x) => ({ ...x, status: 'asked', askedId: id, log: log(x, `Asked ${nm(id)} to check in.`) })); toast(`${nm(id)} has been asked to check in.`); setAskFor(null); }} />}
      {backupFor && <BackupDialog r={backupFor} candidates={adults(profile)} allowed={profile.consent.allowBackupNotification} onClose={() => setBackupFor(null)}
        onSave={(id, agreed, required) => { updateReminder(backupFor.id, (x) => ({ ...x, backupId: id, backupAgreed: agreed, required, log: log(x, agreed ? `${nm(id)} agreed to be backup.` : `${nm(id)} added as backup, waiting for agreement.`) })); toast(agreed ? `${nm(id)} is now the agreed backup.` : 'Backup saved. Notifications start after agreement.'); setBackupFor(null); }} />}
      {contactOpen && <ContactDialog initial={care.emergencyContact} onClose={() => setContactOpen(false)} onSave={(c) => { setCare((x) => ({ ...x, emergencyContact: c })); toast('Trusted contact saved on this device.'); setContactOpen(false); }} />}
    </div>
  );
}

function AskDialog({ r, people, onClose, onAsk }: { r: Reminder; people: FamilyMember[]; onClose: () => void; onAsk: (id: string) => void }) {
  const [id, setId] = useState(people[0]?.id ?? '');
  return (
    <Modal open title="Ask a family member" description={`Ask someone to gently check in about “${r.title}”.`} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-royal" disabled={!id} onClick={() => onAsk(id)}>Send request</button></>}>
      <fieldset><legend className="sr-only">Who to ask</legend><div className="stack">{people.map((m) => (
        <label key={m.id} className="choice"><input type="radio" name="ask" checked={id === m.id} onChange={() => setId(m.id)} /><span className="choice-body"><MemberAvatar member={m} size={32} /><span className="choice-label">{m.name} <span className="muted small">({m.role})</span></span></span></label>))}</div></fieldset>
    </Modal>
  );
}

function BackupDialog({ r, candidates, allowed, onClose, onSave }: { r: Reminder; candidates: FamilyMember[]; allowed: boolean; onClose: () => void; onSave: (id: string, agreed: boolean, required: boolean) => void }) {
  const [id, setId] = useState(r.backupId ?? candidates[0]?.id ?? '');
  const [agreed, setAgreed] = useState(r.backupAgreed);
  const [required, setRequired] = useState(r.required);
  return (
    <Modal open title="Assign a care backup" description={`For “${r.title}”. Backups are never notified without agreement.`} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-royal" disabled={!id} onClick={() => onSave(id, agreed, required)}>Assign Care Backup</button></>}>
      {candidates.length === 0 ? <p>Add another adult to the household to assign a backup.</p> : (
        <>
          <div className="field"><label className="label" htmlFor="bk">Backup person</label><select id="bk" className="select" value={id} onChange={(e) => setId(e.target.value)}>{candidates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <Switch checked={agreed} onChange={setAgreed} label="Both people have agreed to this" description="Backup notifications only work after agreement." />
          <Switch checked={required} onChange={setRequired} label="This reminder is required" description="Backups are only notified for required reminders." />
          {!allowed && <p className="notice notice-safety"><span>Backup notifications are turned off in your household sharing settings, so none will be sent.</span></p>}
        </>
      )}
    </Modal>
  );
}

function ContactDialog({ initial, onClose, onSave }: { initial: { name: string; relationship: string; note: string } | null; onClose: () => void; onSave: (c: { name: string; relationship: string; note: string }) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [rel, setRel] = useState(initial?.relationship ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [err, setErr] = useState('');
  const save = () => {
    const n = sanitizeText(name, 60);
    if (!n) { setErr('Enter the contact’s name.'); return; }
    onSave({ name: n, relationship: sanitizeText(rel, 40) || 'Trusted contact', note: sanitizeText(note, 120) });
  };
  return (
    <Modal open title="Trusted contact" description="Stored only on this device. Never contacted automatically." onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-royal" onClick={save}>Save contact</button></>}>
      <div className="field"><label className="label" htmlFor="ec-n">Name</label><input id="ec-n" data-autofocus className="input" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setErr(''); }} aria-invalid={!!err} /></div>
      <div className="field"><label className="label" htmlFor="ec-r">Relationship</label><input id="ec-r" className="input" value={rel} maxLength={40} onChange={(e) => setRel(e.target.value)} /></div>
      <div className="field"><label className="label" htmlFor="ec-o">How the family reaches them (optional)</label><input id="ec-o" className="input" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /><span className="hint">For example “family group chat”. Do not rely on this prototype in an emergency.</span></div>
      {err && <p className="error-text" role="alert">{err}</p>}
    </Modal>
  );
}
