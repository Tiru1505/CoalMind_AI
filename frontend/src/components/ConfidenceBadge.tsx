import { cx } from '../utils/format'

export function confidenceBand(c: number) {
  return c >= 90 ? 'high' : c >= 80 ? 'medium' : 'low'
}

const TONE = {
  high: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', bar: 'bg-emerald-500', label: 'High' },
  medium: { chip: 'bg-amber-50 text-amber-800 ring-amber-600/25', bar: 'bg-amber-500', label: 'Medium' },
  low: { chip: 'bg-red-50 text-red-700 ring-red-600/20', bar: 'bg-red-500', label: 'Low' },
}

export default function ConfidenceBadge({ value, showBar = false, showLabel = false }: { value: number | null; showBar?: boolean; showLabel?: boolean }) {
  if (value == null) return <span className="text-slate-400">—</span>
  const t = TONE[confidenceBand(value)]
  if (showBar) {
    return (
      <div className="flex items-center gap-2 min-w-[92px]" title={`${t.label} confidence`}>
        <div className="h-1.5 w-12 rounded-full bg-slate-200 overflow-hidden">
          <div className={cx('h-full rounded-full', t.bar)} style={{ width: `${value}%` }} />
        </div>
        <span className="text-[12px] tabular-nums font-medium text-slate-700">{value.toFixed(1)}%</span>
      </div>
    )
  }
  return (
    <span className={cx('chip ring-1 ring-inset tabular-nums', t.chip)} title={`${t.label} confidence`}>
      {Math.round(value)}%{showLabel && <span className="font-normal opacity-80">· {t.label}</span>}
    </span>
  )
}
