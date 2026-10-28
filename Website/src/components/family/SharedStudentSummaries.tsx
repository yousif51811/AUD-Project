import { useWorkspace } from '@/workspace/Workspace';
import { useApp } from '@/state/store';
export function SharedStudentSummaries() { const w = useWorkspace(), app = useApp(); const rows = w.records.filter(r => r.kind === 'student-summary' && r.authorId !== w.actorId); if (!rows.length)
    return null; return <section className="daily-paper stack"><h2>What others chose to share</h2>{rows.map(r => <article className="card stack" key={r.id}><h3>{app.profile?.members.find(m => m.id === r.authorId)?.name ?? 'A family member'}</h3>{typeof r.data.workloadMinutes === 'number' && <p>Recorded study commitments: {r.data.workloadMinutes} minutes.</p>}{Array.isArray(r.data.exams) && <p>Shared academic commitments: {(r.data.exams as Array<{
    title: string;
}>).map(e => e.title).join(', ') || 'None recorded'}</p>}{typeof r.data.sleepAverage === 'number' && <p>Shared sleep average: {r.data.sleepAverage.toFixed(1)} hours.</p>}{typeof r.data.supportRequest === 'string' && <p>{r.data.supportRequest}</p>}<span className="hint">Only the fields this member explicitly enabled are included.</span></article>)}</section>; }
