import type { ReactNode } from 'react'
import { cx } from '../utils/format'

export default function ChartCard({ title, subtitle, action, children, className, bodyClass }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string
}) {
  return (
    <section className={cx('card flex flex-col min-w-0', className)}>
      <header className="card-header">
        <div className="min-w-0">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={cx('p-4 flex-1 min-w-0', bodyClass)}>{children}</div>
    </section>
  )
}
