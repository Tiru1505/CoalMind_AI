import { Eye, FileText, ShieldCheck } from 'lucide-react'
import type { Source } from '../types'
import ConfidenceBadge from './ConfidenceBadge'

export default function SourceCitation({ source, index, onView }: { source: Source; index: number; onView: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 hover:border-brand-300 transition group">
      <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold grid place-items-center shrink-0">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-slate-800 leading-snug">{source.document_title}</div>
          <div className="text-[11px] text-slate-500 font-mono truncate flex items-center gap-1" title={source.filename}><FileText className="w-3 h-3 shrink-0" />{source.filename}</div>
        </div>
      </div>
      <div className="mt-2 text-[12px] text-slate-700 font-serif bg-yellow-50/80 border-l-2 border-yellow-400 px-2 py-1 line-clamp-2" title={source.snippet}>{source.snippet}</div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
        <div><div className="text-slate-400">Page</div><div className="font-semibold text-slate-800 text-[12.5px]">{source.page}</div></div>
        <div><div className="text-slate-400">Relevance</div><div className="font-semibold text-slate-800 text-[12.5px] tabular-nums">{source.relevance}%</div></div>
        <div><div className="text-slate-400">Extraction</div><ConfidenceBadge value={source.extraction_confidence} /></div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-emerald-700 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />{source.validation_status}</span>
        <button onClick={onView} className="btn-secondary btn-sm"><Eye className="w-3.5 h-3.5" /> View Source</button>
      </div>
    </div>
  )
}
