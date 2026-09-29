import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileImage, FileSpreadsheet, FileText, FileType2, Languages, Play, ShieldCheck } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ConfidenceBadge from './ConfidenceBadge'
import type { DocumentItem } from '../types'
import { cx, fmtDate, fileSize } from '../utils/format'

export function FileIcon({ type, className }: { type: string; className?: string }) {
  const map: Record<string, [typeof FileText, string]> = {
    pdf: [FileText, 'text-red-600 bg-red-50'], xlsx: [FileSpreadsheet, 'text-emerald-700 bg-emerald-50'],
    docx: [FileType2, 'text-brand-600 bg-brand-50'], jpg: [FileImage, 'text-violet-600 bg-violet-50'], png: [FileImage, 'text-violet-600 bg-violet-50'],
  }
  const [Icon, cls] = map[type] || [FileText, 'text-slate-600 bg-slate-100']
  return <span className={cx('w-8 h-8 rounded-md grid place-items-center shrink-0', cls, className)}><Icon className="w-4 h-4" /></span>
}

export default function DocumentTable({ docs, highlightId }: { docs: DocumentItem[]; highlightId?: number | null }) {
  const nav = useNavigate()
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="table-base min-w-[1100px] [&_td]:!px-3 [&_th]:!px-3">
        <thead>
          <tr>
            <th>Document</th><th>Type</th><th>Mine / Area</th><th>Financial Year</th><th>Uploaded By</th>
            <th>Status</th><th>Confidence</th><th>Uploaded On</th><th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} onClick={() => nav(`/documents/${d.id}`)}
              className={cx('cursor-pointer hover:bg-slate-50/80 transition-colors', highlightId === d.id && 'animate-flash')}>
              <td>
                <div className="flex items-center gap-3">
                  <FileIcon type={d.file_type} />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate max-w-[300px]" title={d.title}>{d.title}</div>
                    <div className="text-[11.5px] text-slate-500 truncate max-w-[300px] flex items-center gap-1.5" title={d.filename}>
                      <span className="truncate">{d.filename}</span>
                      {d.language.includes('Hindi') && <span className="chip !py-0 bg-orange-50 text-orange-700 shrink-0"><Languages className="w-3 h-3" />हिंदी</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap"><span className="uppercase text-[11.5px] font-semibold text-slate-600">{d.file_type}</span><div className="text-[11px] text-slate-400" title={fileSize(d.size_kb)}>{d.source_kind}</div></td>
              <td className="text-slate-700 whitespace-nowrap">{d.mine}<div className="text-[11px] text-slate-400 max-w-[150px] truncate" title={d.category}>{d.category}</div></td>
              <td className="text-slate-700 tabular-nums whitespace-nowrap">FY {d.financial_year}</td>
              <td className="text-slate-700 whitespace-nowrap">{d.uploaded_by}</td>
              <td><StatusBadge status={d.status} /></td>
              <td><ConfidenceBadge value={d.confidence} showBar /></td>
              <td className="text-slate-600 whitespace-nowrap">{fmtDate(d.uploaded_at)}</td>
              <td className="text-right" onClick={(e) => e.stopPropagation()}>
                {d.status === 'Uploaded' || d.status === 'Failed' ? (
                  <button className="btn-primary btn-sm" onClick={() => nav(`/documents/${d.id}?autoprocess=1`)}><Play className="w-3.5 h-3.5" /> {d.status === 'Failed' ? 'Retry' : 'Process'}</button>
                ) : d.status === 'Validation Required' ? (
                  <button className="btn-secondary btn-sm !border-amber-300 !text-amber-800" onClick={() => nav(`/documents/${d.id}/extraction`)}><ShieldCheck className="w-3.5 h-3.5" /> Validate</button>
                ) : (
                  <button className="btn-ghost btn-sm" onClick={() => nav(`/documents/${d.id}/extraction`)}>View <ChevronRight className="w-3.5 h-3.5" /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
