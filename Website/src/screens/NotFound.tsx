import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="container section">
      <div className="state-box">
        <span className="state-icon"><Compass size={26} aria-hidden /></span>
        <h1 tabIndex={-1} data-page-heading style={{ fontSize: 'var(--fs-2xl)' }}>This page does not exist</h1>
        <p className="muted">The link may be old or mistyped. Your family data is safe on this device.</p>
        <div className="cluster" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn btn-primary">Back to overview</Link>
          <Link to="/dashboard" className="btn btn-secondary">Open dashboard</Link>
        </div>
      </div>
    </div>
  );
}
