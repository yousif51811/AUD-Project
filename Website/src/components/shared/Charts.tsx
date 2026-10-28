import { t, useLanguage } from '@/i18n';
import { useId } from 'react';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CategoryScore, FamilyMember } from '@/types';
import type { BalanceEntry } from '@/lib/people';

const STATUS_COLOR: Record<string, string> = {
  strong: '#2e9d68', stable: '#b7d3df', attention: '#e6c287', priority: '#e4b9a0',
};

/** Harmony Score ring. Animates only when entering view; a text equivalent is always provided. */
export function ScoreRing({ score, status, statusKey, size = 200, dark = false, label = 'Household Harmony Score' }: { score: number; status: string; statusKey: string; size?: number; dark?: boolean; label?: string }) {
  useLanguage();
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const reduced = useReducedMotion();
  const r = 54;
  const c = 2 * Math.PI * r;
  const show = seen || reduced;
  const offset = show ? c * (1 - score / 100) : c;
  const color = STATUS_COLOR[statusKey] ?? '#b7d3df';
  return (
    <div ref={ref} className="score-ring" style={{ width: size }} role="img" aria-label={t('{label}: {score} out of 100. Status: {status}.', {label: t(label), score, status: t(status)})}>
      <svg viewBox="0 0 140 140" width={size} height={size} aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke={dark ? 'rgba(255,255,255,0.16)' : '#e4eaf2'} strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 70 70)" style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(.22,.8,.28,1)' }} />
      </svg>
      <div className="score-ring-center" style={{ color: dark ? '#fff' : 'var(--ink)' }}>
        <span className="score-num num" style={{ fontSize: size * 0.28 }}>{score}</span>
        {size >= 120 && <span className="score-of">{t("out of 100")}</span>}
      </div>
    </div>
  );
}

export function CategoryScoreBar({ c }: { c: CategoryScore }) {
  useLanguage();
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const reduced = useReducedMotion();
  const w = seen || reduced ? c.score : 0;
  const tone = !c.applicable ? 'pill' : c.score >= 80 ? 'pill pill-ok' : c.score >= 60 ? 'pill pill-info' : c.score >= 40 ? 'pill pill-warn' : 'pill pill-danger';
  return (
    <div ref={ref} className="cat-bar">
      <div className="between row" style={{ alignItems: 'baseline' }}>
        <span className="strong">{t(c.label)}</span>
        <span className="cluster" style={{ gap: 8 }}><span className="num strong">{c.applicable ? c.score : '—'}</span><span className={tone}>{t(c.statusLabel)}</span></span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={c.score} aria-valuemin={0} aria-valuemax={100} aria-label={t('{label}: {score} out of 100, {status}', {label: t(c.label), score: c.score, status: t(c.statusLabel)})}>
        <span style={{ width: `${w}%`, transition: reduced ? 'none' : undefined }} />
      </div>
      <p className="xs muted">{t(c.description)}</p>
    </div>
  );
}

export interface TrendPoint { day: string; value: number }

/** Seven-point line chart with a visible table-equivalent summary. */
export function TrendChart({ points, label, summary }: { points: TrendPoint[]; label: string; summary: string }) {
  useLanguage();
  const id = useId();
  const w = 320, h = 140, pad = 24;
  const min = 0, max = 100;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <figure className="chart" aria-labelledby={`${id}-c`}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}. ${summary}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 50, 100].map((g) => (
          <g key={g}><line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="#dce3ec" strokeDasharray="3 4" /><text x={pad - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="#5b6472">{g}</text></g>
        ))}
        <path d={area} fill="rgba(41,190,253,0.15)" />
        <path d={d} fill="none" stroke="#123c69" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (<g key={p.day}><circle cx={x(i)} cy={y(p.value)} r="4" fill="#fff" stroke="#123c69" strokeWidth="2" /><text x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="#3f4a5c">{p.day}</text></g>))}
      </svg>
      <figcaption id={`${id}-c`} className="xs muted"><strong>{t(label)}.</strong> {summary}</figcaption>
      <details className="chart-data"><summary className="xs">{t("View data as text")}</summary>
        <ul className="xs">{points.map((p) => <li key={p.day}>{p.day}: {p.value}</li>)}</ul>
      </details>
    </figure>
  );
}

const MEMBER_FILL: Record<string, string> = { blue: '#b7d3df', gold: '#e6c287', teal: '#b9d0a8', violet: '#d5c9df', red: '#f0707a' };

/** Stacked responsibility distribution with legend and text summary. */
export function ResponsibilityChart({ entries, label = 'Responsibility distribution', caption }: { entries: BalanceEntry[]; label?: string; caption?: string }) {
  useLanguage();
  const total = entries.reduce((a, e) => a + e.percent, 0);
  const shown = entries.filter((e) => e.percent > 0);
  const top = [...entries].sort((a, b) => b.percent - a.percent)[0];
  const summary = top && total > 0 ? `${top.member.name} holds the largest share at ${top.percent}%.` : 'No responsibilities are scheduled yet.';
  return (
    <figure className="chart">
      <div className="resp-bar" role="img" aria-label={`${label}. ${shown.map((e) => `${e.member.name} ${e.percent}%`).join(', ') || 'no data'}. ${summary}`}>
        {shown.map((e) => (
          <span key={e.member.id} style={{ width: `${e.percent}%`, background: MEMBER_FILL[e.member.color] }} title={`${e.member.name}: ${e.percent}%`}>
            {e.percent >= 15 && <span className="resp-pct">{e.percent}%</span>}
          </span>
        ))}
        {shown.length === 0 && <span style={{ width: '100%', background: '#e4eaf2' }} />}
      </div>
      <ul className="legend">
        {entries.map((e) => (
          <li key={e.member.id}><span className="legend-dot" style={{ background: MEMBER_FILL[e.member.color] }} aria-hidden />{e.member.name} <span className="num strong">{e.percent}%</span> <span className="muted xs">({e.minutes}{t(" min)")}</span></li>
        ))}
      </ul>
      <figcaption className="xs muted">{caption ?? summary}</figcaption>
    </figure>
  );
}

export function MiniMeter({ value, max, label }: { value: number; max: number; label: string }) {
  useLanguage();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export type { FamilyMember };
