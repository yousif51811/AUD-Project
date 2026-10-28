import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from './Workspace';
export function AccountGate({ children }: {
    children: ReactNode;
}) {
    const w = useWorkspace();
    if (w.mode === 'demo')
        return children;
    if (w.user && w.identity && w.family)
        return children;
    return <main className="family-main stack"><h1>Your private family space</h1><p>{!w.user ? 'Sign in or try the fictional family.' : !w.identity ? 'Unlock your encrypted vault to continue.' : 'Create or join a family to get started.'}</p><Link className="btn btn-primary" to="/account">Continue to your account</Link><Link className="btn btn-secondary" to="/demo">Try the sample family</Link></main>;
}
