import { Link } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { ScoreRing } from '../pages/ConsistencyPage'
import type { DashboardData } from '../types'
import { cx } from '../utils/format'

/** Dashboard summary of Consistency Guard (cross-source figure reconciliation). */
export default function ConsistencyCard({ c, className }: { c: DashboardData['consistency']; className?: string }) {
  return (
    <section className={cx('card p-5 flex flex-col sm:flex-row gap-5', className)}>
      <div className="flex flex-col items-center justify-center shrink-0">
        <ScoreRing score={c.score} size={116} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="card-title">Consistency Guard</h3>
          <span className="chip bg-coal-50 text-coal-700 !text-[10.5px]"><Sparkles className="w-3 h-3" /> Star feature</span>
        </div>
        <p className="text-[12.5px] text-slate-500 mt-0.5">
          {c.cross_checked} figures cross-checked across documents · {c.agree_count} agree · {c.resolved_count} resolved
        </p>
        {c.top.length === 0 ? (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-emerald-700"><CheckCircle2 className="w-4 h-4" /> No conflicting figures in your workspace.</div>
        ) : (
          <ul className="mt-3 space-y-2">
            {c.top.map((t) => (
              <li key={t.key} className="flex items-center gap-2 text-[12.5px]">
                {t.severity === 'high' ? <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                <span className="text-slate-800 font-medium truncate">{t.label} · {t.mine} · FY {t.fy}</span>
                <span className="ml-auto text-slate-500 tabular-nums shrink-0">{t.values.join(' vs ')}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/consistency" className="btn-secondary btn-sm mt-4">
          {c.open_conflicts ? `Review ${c.open_conflicts} conflict${c.open_conflicts > 1 ? 's' : ''}` : 'Open Consistency Guard'} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  )
}
