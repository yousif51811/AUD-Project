import { Link } from 'react-router-dom';
import { ClipboardList, Sparkles } from 'lucide-react';
import { useApp } from '@/state/store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EmptyState, PageHeader } from '@/components/shared/Common';
import { ResultView } from '@/components/assessment/ResultView';
import { useToast } from '@/components/shared/Toast';

export default function Results() {
  useDocumentTitle('Your results');
  const { result, assessment, restoreDemo } = useApp();
  const { toast } = useToast();
  if (!result || !assessment) {
    return (
      <>
        <PageHeader title="Our check-in results." />
        <EmptyState icon={<ClipboardList size={26} />} title="No results yet" message="Complete the eight-question family check-in to see your Household Harmony Score and explainable next steps."
          actions={<><Link to="/assessment" className="btn btn-primary">Start Family Check-In</Link><button type="button" className="btn btn-secondary" onClick={() => { restoreDemo(); toast('Al Noor demo restored.'); }}><Sparkles size={16} aria-hidden /> Restore Al Noor demo</button></>} />
      </>
    );
  }
  return (
    <div className="stack stack-lg">
      <PageHeader eyebrow={assessment.source === 'demo' ? 'Al Noor demo household' : 'Explainable results'} title="Our check-in results." lede="Reported signals, connected patterns and suggested actions, with the reasoning shown." />
      <ResultView result={result} record={assessment} />
    </div>
  );
}
