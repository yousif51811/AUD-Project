import { t, useLanguage } from '@/i18n';
export function LoadingPage() {
  useLanguage();
  return (
    <div className="container section-tight" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t("Loading…")}</span>
      <div className="stack stack-lg" aria-hidden>
        <div className="skeleton" style={{ height: 28, width: '40%' }} />
        <div className="skeleton" style={{ height: 56, width: '75%' }} />
        <div className="grid grid-3">
          <div className="skeleton" style={{ height: 160 }} />
          <div className="skeleton" style={{ height: 160 }} />
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      </div>
    </div>
  );
}

export function LoadingBlock({ height = 160 }: { height?: number }) {
  useLanguage();
  return <div className="skeleton" style={{ height }} role="status" aria-label={t("Loading")} />;
}
