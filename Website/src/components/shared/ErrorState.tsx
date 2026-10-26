import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

/** Shown instead of a blank screen. Never exposes stack traces. */
export function ErrorState({ title = 'Something did not load', message = 'Your information is safe on this device. You can try again or go back to the overview.', onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="state-box" role="alert">
      <span className="state-icon danger"><AlertTriangle size={26} aria-hidden /></span>
      <h2 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h2>
      <p className="muted">{message}</p>
      <div className="cluster" style={{ justifyContent: 'center' }}>
        {onRetry && <button className="btn btn-royal" type="button" onClick={onRetry}><RefreshCw size={18} aria-hidden /> Try again</button>}
        <a className="btn btn-secondary" href="/"><Home size={18} aria-hidden /> Back to overview</a>
      </div>
    </div>
  );
}

interface State { failed: boolean }
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; onError?: () => void; resetKey?: string }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { this.props.onError?.(); }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return this.props.fallback ?? <ErrorState onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}
