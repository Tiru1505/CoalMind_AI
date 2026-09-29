import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '../utils/format'

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size]
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto no-print" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className={cx('relative w-full bg-white rounded-lg shadow-pop animate-fade-in my-auto', w)}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <div className="text-[12.5px] text-slate-500 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm !px-1.5" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 rounded-b-lg flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
