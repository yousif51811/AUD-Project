import { t, useLanguage } from '@/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from './Workspace';
export function AccountGate({ children }: {
    children: ReactNode;
}) {
  useLanguage();
    const w = useWorkspace();
    if (w.mode === 'demo')
        return children;
    if (w.user && w.identity && w.family)
        return children;
    return <main className="family-main stack"><h1>{t("Your private family space")}</h1><p>{!w.user ? t("Sign in or try the fictional family.") : !w.identity ? t("Restore access to your family space.") : t("Create or join a family to get started.")}</p><Link className="btn btn-primary" to="/account">{t("Continue to your account")}</Link><Link className="btn btn-secondary" to="/demo">{t("Try the sample family")}</Link></main>;
}
