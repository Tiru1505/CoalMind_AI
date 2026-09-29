import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cx } from '../utils/format'

type Kind = 'success' | 'error' | 'info' | 'warning'
interface Toast { id: number; kind: Kind; title: string; body?: string }

const Ctx = createContext<(kind: Kind, title: string, body?: string) => void>(() => {})

const ICON = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const TONE = {
  success: 'border-l-emerald-500 [&_svg]:text-emerald-600',
  error: 'border-l-red-500 [&_svg]:text-red-600',
  info: 'border-l-brand-500 [&_svg]:text-brand-600',
  warning: 'border-l-amber-500 [&_svg]:text-amber-600',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Kind, title: string, body?: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6500 : 4200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[360px] no-print" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICON[t.kind]
          return (
            <div key={t.id} className={cx('bg-white border border-slate-200 border-l-4 rounded-md shadow-pop px-4 py-3 flex gap-3 animate-slide-in', TONE[t.kind])}>
              <Icon className="w-[18px] h-[18px] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-800">{t.title}</div>
                {t.body && <div className="text-[12.5px] text-slate-600 mt-0.5">{t.body}</div>}
              </div>
              <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4 !text-slate-400" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
