import { useMemo, useState } from 'react';
import { AlertCircle, BookHeart, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { MemoryEntry, MemoryType, MemoryVisibility } from '@/types';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ChoiceCard, EmptyState, MemberAvatar, PageHeader } from '@/components/shared/Common';
import { Modal } from '@/components/shared/Modal';
import { sanitizeText } from '@/lib/sanitize';

const TYPES: MemoryType[] = ['Gratitude', 'Achievement', 'Kind Message', 'Family Tradition', 'Weekly Win', 'Story', 'Photo Memory Description'];
const VIS: MemoryVisibility[] = ['Only me', 'Selected members', 'Household'];

function fmt(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default function Memories() {
  useDocumentTitle('Memory Vault');
  const { memories, profile, addMemory, updateMemory, deleteMemory } = useApp();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [type, setType] = useState<MemoryType | 'All'>('All');
  const [vis, setVis] = useState<MemoryVisibility | 'All'>('All');
  const [editing, setEditing] = useState<MemoryEntry | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MemoryEntry | null>(null);
  const members = profile?.members ?? [];

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return memories
      .filter((m) => (type === 'All' || m.type === type) && (vis === 'All' || m.visibility === vis))
      .filter((m) => !s || m.title.toLowerCase().includes(s) || m.message.toLowerCase().includes(s) || m.tagIds.some((id) => members.find((x) => x.id === id)?.name.toLowerCase().includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [memories, q, type, vis, members]);

  return (
    <div className="stack stack-lg">
      <PageHeader eyebrow="Family Memory Vault" title="The family keepsakes." lede={("A place for gratitude, wins and stories, stored in this shared browser workspace.")}
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> Add memory</button>} />

      <div className="card stack">
        <div className="grid grid-3">
          <div className="field"><label className="label" htmlFor="mq">Search memories</label>
            <div className="input-icon"><Search size={18} aria-hidden /><input id="mq" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <div className="field"><label className="label" htmlFor="mt">Type</label><select id="mt" className="select" value={type} onChange={(e) => setType(e.target.value as MemoryType | 'All')}><option>All</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="mv">Visibility</label><select id="mv" className="select" value={vis} onChange={(e) => setVis(e.target.value as MemoryVisibility | 'All')}><option>All</option>{VIS.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <p className="xs muted" role="status" aria-live="polite">{list.length} of {memories.length} memor{memories.length === 1 ? 'y' : 'ies'} shown.</p>
      </div>

      {memories.length === 0 ? (
        <EmptyState icon={<BookHeart size={26} />} title="Your vault is empty" message="Start with one thing you are grateful for this week. Small moments matter most." actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>Add the first memory</button>} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Search size={26} />} title="No memories match" message="Try a different word, or clear the filters." actions={<button type="button" className="btn btn-secondary" onClick={() => { setQ(''); setType('All'); setVis('All'); }}>Clear filters</button>} />
      ) : (
        <ul className="memory-grid">
          {list.map((m) => (
            <li key={m.id} className="card memory-card stack">
              <div className="between row"><span className="pill pill-ok">{m.type}</span><span className="xs muted">{fmt(m.date)}</span></div>
              <h2 style={{ fontSize: 'var(--fs-lg)' }}>{m.title}</h2>
              <p className="muted">{m.message}</p>
              <div className="between row wrap-row">
                <span className="row" style={{ gap: 6 }}>{m.tagIds.map((id) => members.find((x) => x.id === id)).filter(Boolean).map((x) => <span key={x!.id} className="row" style={{ gap: 4 }}><MemberAvatar member={x!} size={24} /><span className="xs">{x!.name}</span></span>)}</span>
                <span className="pill">{m.visibility}</span>
              </div>
              <div className="cluster">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(m)} aria-label={`Edit ${m.title}`}><Pencil size={16} aria-hidden /> Edit</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(m)} aria-label={`Delete ${m.title}`}><Trash2 size={16} aria-hidden /> Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <MemoryEditor key={editing === 'new' ? 'new' : editing.id} target={editing} onClose={() => setEditing(null)}
        onSave={(m, isNew) => { if (isNew) { addMemory(m); toast('Memory saved.'); } else { updateMemory((editing as MemoryEntry).id, m); toast('Memory updated.'); } setEditing(null); }} />}
      <Modal open={!!deleting} alert title="Delete this memory?" description={deleting ? `“${deleting.title}” will be removed from this device. This cannot be undone.` : ''} onClose={() => setDeleting(null)}
        footer={<><button type="button" data-autofocus className="btn btn-ghost" onClick={() => setDeleting(null)}>Keep memory</button><button type="button" className="btn btn-danger" onClick={() => { if (deleting) { deleteMemory(deleting.id); toast('Memory deleted.', 'warn'); } setDeleting(null); }}>Delete memory</button></>}><span /></Modal>
    </div>
  );
}

function MemoryEditor({ target, onClose, onSave }: { target: MemoryEntry | 'new'; onClose: () => void; onSave: (m: Omit<MemoryEntry, 'id'>, isNew: boolean) => void }) {
  const { profile } = useApp();
  const members = profile?.members ?? [];
  const isNew = target === 'new';
  const b = isNew ? null : target;
  const [type, setType] = useState<MemoryType>(b?.type ?? 'Gratitude');
  const [title, setTitle] = useState(b?.title ?? '');
  const [message, setMessage] = useState(b?.message ?? '');
  const [date, setDate] = useState(b?.date ?? todayISO());
  const [tags, setTags] = useState<string[]>(b?.tagIds ?? []);
  const [visibility, setVisibility] = useState<MemoryVisibility>(b?.visibility ?? 'Household');
  const [errs, setErrs] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    const t = sanitizeText(title, 80);
    const m = sanitizeText(message, 500);
    if (!t) e.title = 'Give the memory a short title.';
    if (!m) e.message = 'Write a few words about this moment.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) e.date = 'Choose a valid date.';
    if (visibility === 'Selected members' && tags.length === 0) e.tags = 'Tag at least one member, or choose a different visibility.';
    setErrs(e);
    if (Object.keys(e).length) return;
    onSave({ type, title: t, message: m, date, tagIds: tags, visibility }, isNew);
  };
  const errList = Object.values(errs);
  return (
    <Modal open wide title={isNew ? 'Add a memory' : 'Edit memory'} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-royal" onClick={save}>Save memory</button></>}>
      {errList.length > 0 && <div className="error-summary" role="alert"><strong>Please fix:</strong><ul>{errList.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div className="grid grid-2">
        <div className="field"><label className="label" htmlFor="me-type">Entry type</label><select id="me-type" className="select" value={type} onChange={(e) => setType(e.target.value as MemoryType)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label className="label" htmlFor="me-date">Date</label><input id="me-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errs.date} /></div>
      </div>
      <div className="field"><label className="label" htmlFor="me-t">Title</label><input id="me-t" data-autofocus className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errs.title} aria-describedby={errs.title ? 'me-t-e' : undefined} />{errs.title && <span id="me-t-e" className="error-text"><AlertCircle size={14} aria-hidden /> {errs.title}</span>}</div>
      <div className="field"><label className="label" htmlFor="me-m">Message</label><textarea id="me-m" className="textarea" rows={4} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errs.message} aria-describedby="me-m-c" /><span id="me-m-c" className="counter num">{message.length}/500</span></div>
      <fieldset><legend className="label">Tag family members (optional)</legend><div className="choices" style={{ marginTop: 8 }}>{members.map((m) => <ChoiceCard key={m.id} type="checkbox" name="me-tags" value={m.id} label={m.name} checked={tags.includes(m.id)} onChange={(c) => setTags((x) => (c ? [...x, m.id] : x.filter((y) => y !== m.id)))} />)}</div></fieldset>
      <fieldset><legend className="label">Who can see this</legend><div className="choices" style={{ marginTop: 8 }}>{VIS.map((v) => <ChoiceCard key={v} name="me-vis" value={v} label={v} hint={("Demonstration label; this browser does not restrict member access.")} checked={visibility === v} onChange={() => setVisibility(v)} />)}</div></fieldset>
    </Modal>
  );
}
