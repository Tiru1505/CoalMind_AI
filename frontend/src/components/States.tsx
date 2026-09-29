/** LoadingState, EmptyState and ErrorState — shared feedback components. */
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AlertOctagon, Inbox, Loader2, RefreshCw } from 'lucide-react'

export function LoadingState({ label = 'Loading…', rows = 0 }: { label?: string; rows?: number }) {
  if (rows > 0) {
    return (
      <div className="space-y-3 p-1" aria-busy="true" aria-label={label}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-10" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-[13px]" aria-busy="true">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, body, action }: { icon?: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-11 h-11 rounded-full bg-slate-100 grid place-items-center mb-3"><Icon className="w-5 h-5 text-slate-500" /></div>
      <div className="text-[14px] font-semibold text-slate-800">{title}</div>
      {body && <div className="text-[13px] text-slate-500 mt-1 max-w-md">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-red-200 bg-red-50/40 p-5 flex items-start gap-3" role="alert">
      <AlertOctagon className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold text-red-800">Unable to load data</div>
        <div className="text-[13px] text-red-700 mt-0.5">{message}</div>
      </div>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}><RefreshCw className="w-3.5 h-3.5" /> Retry</button>}
    </div>
  )
}
