import { t, useLanguage } from '@/i18n';
import { useWorkspace } from '@/workspace/Workspace';
import { useApp } from '@/state/store';
export function SharedStudentSummaries() {
  useLanguage(); const w = useWorkspace(), app = useApp(); const rows = w.records.filter(r => r.kind === 'student-summary' && r.authorId !== w.actorId); if (!rows.length)
    return null; return <section className="daily-paper stack"><h2>{t("What others chose to share")}</h2>{rows.map(r => <article className="card stack" key={r.id}><h3>{app.profile?.members.find(m => m.id === r.authorId)?.name ?? 'A family member'}</h3>{typeof r.data.workloadMinutes === 'number' && <p>{t("Recorded study commitments: ")}{r.data.workloadMinutes}{t(" minutes.")}</p>}{Array.isArray(r.data.exams) && <p>{t("Shared academic commitments: ")}{(r.data.exams as Array<{
    title: string;
}>).map(e => e.title).join(', ') || 'None recorded'}</p>}{typeof r.data.sleepAverage === 'number' && <p>{t("Shared sleep average: ")}{r.data.sleepAverage.toFixed(1)}{t(" hours.")}</p>}{typeof r.data.supportRequest === 'string' && <p>{r.data.supportRequest}</p>}<span className="hint">{t("Only the fields this member explicitly enabled are included.")}</span></article>)}</section>; }
