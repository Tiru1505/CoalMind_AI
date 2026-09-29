/** Side-by-side source viewer: the cited page with the evidencing line highlighted + provenance metadata. */
import { Link } from 'react-router-dom'
import { ExternalLink, FileText, ShieldCheck } from 'lucide-react'
import Modal from './Modal'
import DocumentPreview from './DocumentPreview'
import ConfidenceBadge from './ConfidenceBadge'
import StatusBadge from './StatusBadge'
import { ErrorState, LoadingState } from './States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'

export interface SourceRef { document_id: number; page: number; snippet?: string; relevance?: number; extraction_confidence?: number; validation_status?: string }

export default function SourceViewer({ source, onClose }: { source: SourceRef | null; onClose: () => void }) {
  return (
    <Modal open={!!source} onClose={onClose} size="xl" title="Source document" subtitle="Every AI-generated figure is traceable to the page it came from.">
      {source && <Body source={source} />}
    </Modal>
  )
}

function Body({ source }: { source: SourceRef }) {
  const { data, error, loading, reload } = useApi(() => api.page(source.document_id, source.page), [source.document_id, source.page])
  if (loading && !data) return <LoadingState label="Opening source page…" />
  if (error || !data) return <div className="p-5"><ErrorState message={error || 'Page not available'} onRetry={reload} /></div>
  const d = data.document
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
      <div className="bg-slate-200/60 p-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
        <DocumentPreview pages={[data.page]} fields={data.fields} totalPages={d.pages} scanned={d.source_kind === 'Scanned'} highlightLine={source.snippet} docTitle={d.title} />
      </div>
      <aside className="p-5 border-t lg:border-t-0 lg:border-l border-slate-200 space-y-4 text-[12.5px]">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-wide font-semibold mb-1"><FileText className="w-3.5 h-3.5" /> Document</div>
          <div className="font-semibold text-slate-800">{d.title}</div>
          <div className="text-slate-500 font-mono text-[11.5px] break-all mt-0.5">{d.filename}</div>
        </div>
        <dl className="divide-y divide-slate-100">
          {[
            ['Page', `${source.page} of ${d.pages}`], ['Section', data.page.title], ['Financial year', `FY ${d.financial_year}`], ['Mine / area', d.mine],
            ['Language', d.language], ['Uploaded by', d.uploaded_by],
          ].map(([k, v]) => <div key={k} className="flex justify-between py-1.5 gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-right">{v}</dd></div>)}
          <div className="flex justify-between py-1.5 items-center"><dt className="text-slate-500">Document status</dt><dd><StatusBadge status={d.status} /></dd></div>
          {source.extraction_confidence != null && <div className="flex justify-between py-1.5 items-center"><dt className="text-slate-500">Extraction confidence</dt><dd><ConfidenceBadge value={source.extraction_confidence} /></dd></div>}
          {source.relevance != null && <div className="flex justify-between py-1.5"><dt className="text-slate-500">Retrieval relevance</dt><dd className="font-medium">{source.relevance}%</dd></div>}
        </dl>
        {source.snippet && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <div className="text-[10.5px] uppercase tracking-wide font-semibold text-yellow-800 mb-1">Cited passage</div>
            <div className="font-serif text-slate-800">{source.snippet}</div>
          </div>
        )}
        {source.validation_status && (
          <div className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="w-4 h-4" /> {source.validation_status}</div>
        )}
        <Link to={`/documents/${d.id}/extraction`} className="btn-secondary w-full"><ExternalLink className="w-3.5 h-3.5" /> Open full extraction view</Link>
      </aside>
    </div>
  )
}
