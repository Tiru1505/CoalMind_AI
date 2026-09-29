import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'
import { cx, fmtInt } from '../utils/format'

interface Props {
  label: string
  value: number
  suffix?: string
  delta?: string | null
  note?: string
  tone?: 'up' | 'warn' | 'neutral' | 'good'
  icon: LucideIcon
  onClick?: () => void
}

const ICON_TONE = {
  up: 'bg-brand-50 text-brand-600', warn: 'bg-amber-50 text-amber-600', neutral: 'bg-slate-100 text-slate-600', good: 'bg-emerald-50 text-emerald-600',
}

export default function KpiCard({ label, value, suffix, delta, note, tone = 'neutral', icon: Icon, onClick }: Props) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={cx('card text-left p-4 flex flex-col gap-3 transition', onClick && 'hover:border-brand-300 hover:shadow-pop cursor-pointer', 'disabled:cursor-default')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
        <span className={cx('w-8 h-8 rounded-md grid place-items-center shrink-0', ICON_TONE[tone])}><Icon className="w-4 h-4" /></span>
      </div>
      <div className="text-[26px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
        {suffix ? value.toFixed(1) : fmtInt(value)}{suffix && <span className="text-[18px] text-slate-500 ml-0.5">{suffix}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-[12px] whitespace-nowrap overflow-hidden">
        {delta && <span className="inline-flex items-center text-emerald-700 font-medium"><ArrowUpRight className="w-3.5 h-3.5" />{delta}</span>}
        <span className={cx('truncate', tone === 'warn' ? 'text-amber-700 font-medium' : 'text-slate-500')}>{note}</span>
      </div>
    </button>
  )
}
