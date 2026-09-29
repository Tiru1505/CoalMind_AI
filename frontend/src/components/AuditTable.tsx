import type { AuditEntry } from '../types'
import StatusBadge from './StatusBadge'
import { Bot, UserRound } from 'lucide-react'
import { cx, fmtDate, fmtTime } from '../utils/format'

export default function AuditTable({ rows, onSelect, selectedId }: { rows: AuditEntry[]; onSelect: (a: AuditEntry) => void; selectedId?: number }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="table-base min-w-[960px]">
        <thead><tr><th>Timestamp</th><th>User</th><th className="w-[30%]">Action</th><th>Document</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>
          {rows.map((a) => {
            const system = a.role === 'System'
            return (
              <tr key={a.id} onClick={() => onSelect(a)} className={cx('cursor-pointer hover:bg-slate-50', selectedId === a.id && 'bg-brand-50/60')}>
                <td className="whitespace-nowrap"><div className="font-medium tabular-nums">{fmtTime(a.timestamp)}</div><div className="text-[11px] text-slate-400">{fmtDate(a.timestamp)}</div></td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className={cx('w-6 h-6 rounded-full grid place-items-center shrink-0', system ? 'bg-ink-900 text-coal-400' : 'bg-brand-50 text-brand-700')}>
                      {system ? <Bot className="w-3.5 h-3.5" /> : <UserRound className="w-3.5 h-3.5" />}
                    </span>
                    <div><div className="whitespace-nowrap">{a.user}</div><div className="text-[11px] text-slate-400">{a.role}</div></div>
                  </div>
                </td>
                <td className="text-slate-800">{a.action}</td>
                <td className="text-slate-600 max-w-[240px] truncate" title={a.document}>{a.document || '—'}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="text-slate-500 text-[12px] whitespace-nowrap">{a.source}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
