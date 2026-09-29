import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { cx } from '../utils/format'

const MAP: Record<string, { cls: string; icon: typeof Clock }> = {
  Approved: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: ShieldCheck },
  Processed: { cls: 'bg-brand-50 text-brand-700 ring-brand-600/20', icon: CheckCircle2 },
  Processing: { cls: 'bg-sky-50 text-sky-700 ring-sky-600/20', icon: Loader2 },
  Uploaded: { cls: 'bg-slate-100 text-slate-700 ring-slate-500/20', icon: Clock },
  'Validation Required': { cls: 'bg-amber-50 text-amber-800 ring-amber-600/25', icon: AlertTriangle },
  Failed: { cls: 'bg-red-50 text-red-700 ring-red-600/20', icon: XCircle },
  Draft: { cls: 'bg-amber-50 text-amber-800 ring-amber-600/25', icon: Clock },
  Completed: { cls: 'bg-brand-50 text-brand-700 ring-brand-600/20', icon: CheckCircle2 },
  Answered: { cls: 'bg-brand-50 text-brand-700 ring-brand-600/20', icon: CheckCircle2 },
  Success: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
  Confirmed: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
  Exported: { cls: 'bg-slate-100 text-slate-700 ring-slate-500/20', icon: CheckCircle2 },
  Corrected: { cls: 'bg-violet-50 text-violet-700 ring-violet-600/20', icon: CheckCircle2 },
  Rejected: { cls: 'bg-red-50 text-red-700 ring-red-600/20', icon: XCircle },
  'Review Required': { cls: 'bg-amber-50 text-amber-800 ring-amber-600/25', icon: AlertTriangle },
  'No Source': { cls: 'bg-slate-100 text-slate-600 ring-slate-500/20', icon: AlertTriangle },
}

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = MAP[status] || { cls: 'bg-slate-100 text-slate-700 ring-slate-500/20', icon: CheckCircle2 }
  const Icon = m.icon
  return (
    <span className={cx('chip ring-1 ring-inset whitespace-nowrap', m.cls, className)}>
      <Icon className={cx('w-3 h-3', status === 'Processing' && 'animate-spin')} />
      {status}
    </span>
  )
}
