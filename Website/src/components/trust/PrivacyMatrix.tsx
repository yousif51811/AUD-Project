import { t, useLanguage } from '@/i18n';
import { Check, Minus, X } from 'lucide-react';

type Cell = 'default' | 'optional' | 'never';
const COLS = ['Private to the member', 'Shared as a summary', 'Shared with selected members', 'Visible to the household'];
const ROWS: { item: string; cells: Cell[] }[] = [
  { item: 'Private journal notes', cells: ['default', 'never', 'never', 'never'] },
  { item: 'Exact mood entries', cells: ['default', 'never', 'never', 'never'] },
  { item: 'Personal messages', cells: ['default', 'never', 'never', 'never'] },
  { item: 'Student workload level', cells: ['default', 'optional', 'never', 'optional'] },
  { item: 'Sleep consistency', cells: ['default', 'optional', 'never', 'optional'] },
  { item: 'Student support request', cells: ['default', 'optional', 'optional', 'optional'] },
  { item: 'Care routine status', cells: ['never', 'default', 'optional', 'optional'] },
  { item: 'Care backup details', cells: ['never', 'never', 'default', 'never'] },
  { item: 'Memory Vault entries', cells: ['optional', 'never', 'optional', 'optional'] },
  { item: 'Household patterns and the agreed plan', cells: ['never', 'never', 'never', 'default'] },
];

const LABEL: Record<Cell, string> = { default: 'Default', optional: 'If the member chooses', never: 'Never' };

export function PrivacyMatrix() {
  useLanguage();
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={t("Privacy matrix (scrollable)")}>
      <table className="matrix">
        <caption className="sr-only">{t("Privacy matrix: what is private, shared as a summary, shared with selected members, or visible to the household")}</caption>
        <thead><tr><th scope="col">{t("Information")}</th>{COLS.map((c) => <th key={c} scope="col">{t(c)}</th>)}</tr></thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={t(r.item)}>
              <th scope="row">{t(r.item)}</th>
              {r.cells.map((c, i) => (
                <td key={i} className={`mx-${c}`}>
                  <span className="mx-cell">{c === 'default' ? <Check size={16} aria-hidden /> : c === 'optional' ? <Minus size={16} aria-hidden /> : <X size={16} aria-hidden />}<span>{t(LABEL[c])}</span></span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
