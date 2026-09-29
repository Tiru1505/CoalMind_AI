import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardCheck, History, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ExtractionField from '../components/ExtractionField'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useShellRefresh } from '../layouts/AppLayout'
import type { DocumentItem, Field } from '../types'
import { fmtInt, timeAgo } from '../utils/format'

export default function ValidationPage() {
  const { can } = useAuth()
  const toast = useToast()
  const refreshShell = useShellRefresh()
  const { data, error, loading, reload } = useApi(api.validationQueue)

  if (loading && !data) return <LoadingState label="Loading validation queue…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />

  const groups = new Map<number, { doc: DocumentItem; fields: Field[] }>()
  for (const f of data.pending) {
    if (!groups.has(f.document_id)) groups.set(f.document_id, { doc: f.document, fields: [] })
    groups.get(f.document_id)!.fields.push(f)
  }
  const after = () => { reload(true); refreshShell() }
  const s = data.stats

  return (
    <div className="animate-fade-in">
      <PageHeader title="Data Validation" subtitle="Human-in-the-loop review of AI-extracted values. Fields below the confidence threshold are held back until an officer approves, corrects or rejects them." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { l: 'Pending review', v: s.pending, i: ClipboardCheck, c: 'text-amber-600 bg-amber-50' },
          { l: 'Approved by officers', v: s.approved, i: ShieldCheck, c: 'text-emerald-600 bg-emerald-50' },
          { l: `Auto-accepted (≥${s.threshold}%)`, v: s.auto_accepted, i: Sparkles, c: 'text-brand-600 bg-brand-50' },
          { l: 'Rejected', v: s.rejected, i: XCircle, c: 'text-red-600 bg-red-50' },
        ].map(({ l, v, i: I, c }) => (
          <div key={l} className="card p-4 flex items-center gap-3">
            <span className={`w-10 h-10 rounded-md grid place-items-center ${c}`}><I className="w-5 h-5" /></span>
            <div><div className="text-[22px] font-semibold tabular-nums leading-none">{fmtInt(v)}</div><div className="text-[12px] text-slate-500 mt-1">{l}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="space-y-5">
          {groups.size === 0 && (
            <div className="card"><EmptyState icon={CheckCircle2} title="Validation queue is clear" body="Every extracted value in the demo library has been reviewed. New low-confidence values will appear here after documents are processed." /></div>
          )}
          {[...groups.values()].map(({ doc, fields }) => (
            <section key={doc.id} className="card">
              <div className="card-header">
                <div className="min-w-0">
                  <h3 className="card-title truncate">{doc.title}</h3>
                  <p className="text-[12px] text-slate-500">{doc.mine} · FY {doc.financial_year} · {fields.length} field{fields.length > 1 ? 's' : ''} awaiting review</p>
                </div>
                <Link to={`/documents/${doc.id}/extraction`} className="btn-secondary btn-sm shrink-0">Open side-by-side <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {fields.map((f) => (
                  <ExtractionField key={f.id + (f.human_value || '')} field={f} active={false} canValidate={can('validate')} onSelect={() => {}}
                    onApprove={async () => { await api.approveField(f.id); toast('success', 'Validated ✓', `${f.label} approved.`); after() }}
                    onEdit={async (v, r) => { await api.editField(f.id, v, r); toast('success', 'Correction saved', 'Approve to publish the corrected value.'); after() }}
                    onReject={async (r) => { await api.rejectField(f.id, r); toast('info', 'Value rejected', `${f.label} excluded.`); after() }} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="card xl:sticky xl:top-20">
          <div className="card-header"><h3 className="card-title flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /> Recent decisions</h3></div>
          {data.recent.length === 0 ? <EmptyState title="No decisions yet" body="Approvals, corrections and rejections will be listed here." /> : (
            <ul className="divide-y divide-slate-100">
              {data.recent.map((r) => (
                <li key={r.id} className="px-4 py-3 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{r.field}</span>
                    <span className={`chip ${r.action === 'approve' ? 'bg-emerald-50 text-emerald-700' : r.action === 'edit' ? 'bg-violet-50 text-violet-700' : 'bg-red-50 text-red-700'}`}>
                      {r.action === 'approve' ? 'Approved' : r.action === 'edit' ? 'Corrected' : 'Rejected'}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {r.action === 'edit' ? <><code>{r.previous_value}</code> → <code className="text-violet-700">{r.new_value}</code></> : <code>{r.previous_value}</code>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.user} · {timeAgo(r.timestamp)}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-3 border-t border-slate-100 text-[11.5px] text-slate-500">Every decision is recorded in the <Link to="/audit" className="text-brand-600 hover:underline">audit trail</Link> with original, AI and corrected values.</div>
        </section>
      </div>
    </div>
  )
}
