import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Info, MessageSquareText, ShieldAlert, ShieldCheck, Wand2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DocumentPreview from '../components/DocumentPreview'
import ExtractionField from '../components/ExtractionField'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useShellRefresh } from '../layouts/AppLayout'
import type { Field } from '../types'
import { cx } from '../utils/format'

type Tab = 'all' | 'review' | 'validated'

/** Smoothly scroll an element into view within its own scroll container only (does not move the window). */
function scrollWithin(id: string) {
  const el = document.getElementById(id)
  const box = el?.closest('.overflow-y-auto') as HTMLElement | null
  if (!el || !box) return
  const top = box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12
  box.scrollTo({ top, behavior: 'smooth' })
  // fallback for environments where smooth scrolling is throttled (hidden tabs, projectors on power-saving)
  setTimeout(() => { if (Math.abs(box.scrollTop - Math.min(top, box.scrollHeight - box.clientHeight)) > 40) box.scrollTop = top }, 700)
}

export default function ExtractionPage() {
  const { id } = useParams()
  const docId = Number(id)
  const nav = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const refreshShell = useShellRefresh()
  const { data, setData, error, loading, reload } = useApi(() => api.extraction(docId), [docId])
  const [active, setActive] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const fields = data?.fields || []
  const pending = fields.filter((f) => f.status === 'pending').sort((a, b) => a.confidence - b.confidence)
  const validated = fields.filter((f) => f.status === 'approved' || f.status === 'auto_accepted')
  const shown = useMemo(() => fields.filter((f) => tab === 'all' || (tab === 'review' ? f.status === 'pending' : f.status !== 'pending')), [fields, tab])

  useEffect(() => {
    if (data && active == null && pending.length) {
      const first = pending[0]
      setActive(first.id)
      setTimeout(() => { scrollWithin(`page-${first.page}`); scrollWithin(`field-${first.id}`) }, 350)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const select = (fid: number, scrollPreview = true) => {
    setActive(fid)
    const f = fields.find((x) => x.id === fid)
    if (f && scrollPreview) scrollWithin(`page-${f.page}`)
    scrollWithin(`field-${fid}`)
  }

  const update = (nf: Field, msg?: [string, string]) => {
    setData((d) => d && { ...d, fields: d.fields.map((f) => (f.id === nf.id ? nf : f)) })
    if (msg) toast('success', msg[0], msg[1])
    refreshShell()
  }

  const afterDecision = async () => {
    const fresh = await api.extraction(docId)
    setData(fresh)
    const left = fresh.fields.filter((f) => f.status === 'pending').sort((a, b) => a.confidence - b.confidence)
    if (left.length === 0) {
      toast('success', 'Document fully validated', 'Verified values are now published to the Knowledge Base and available to AI Query.')
    } else {
      setActive(left[0].id)
    }
  }

  if (loading && !data) return <LoadingState label="Loading extraction results…" />
  if (error || !data) return <ErrorState message={error || 'Not found'} onRetry={reload} />
  const doc = data.document
  if (!data.fields.length) {
    return (
      <div className="card">
        <EmptyState icon={Wand2} title="No extracted data yet" body="This document has not been processed. Run the extraction pipeline first."
          action={<button className="btn-primary" onClick={() => nav(`/documents/${doc.id}`)}>Go to processing</button>} />
      </div>
    )
  }
  const canValidate = can('validate')
  const pct = Math.round((validated.length / fields.length) * 100)

  return (
    <div className="animate-fade-in">
      <Link to={`/documents/${doc.id}`} className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-brand-600 mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Processing details</Link>
      <PageHeader
        title="Extraction & Validation"
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-700">{doc.title}</span> · {doc.pages} pages · {doc.source_kind} <StatusBadge status={doc.status} /></span>}
        actions={pending.length === 0 ? <>
          <Link to="/knowledge" className="btn-secondary"><BookOpenCheck className="w-4 h-4" /> Knowledge Base</Link>
          <Link to={`/ai-query?q=${encodeURIComponent(`What was the production of ${doc.mine} Mine in FY ${doc.financial_year}?`)}`} className="btn-primary"><MessageSquareText className="w-4 h-4" /> Ask AI about this</Link>
        </> : undefined}
      />

      {pending.length > 0 ? (
        <div className="card mb-5 px-4 py-3 flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50/60">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <div className="flex-1 text-[13px] text-amber-900"><b>{pending.length} field{pending.length > 1 ? 's' : ''} require review.</b> Low-confidence values are held back from the knowledge base until an officer approves, corrects or rejects them.</div>
          <button className="btn-secondary btn-sm" onClick={() => { setTab('review'); select(pending[0].id) }}>Review next <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="card mb-5 px-4 py-3 flex flex-wrap items-center gap-3 border-emerald-300 bg-emerald-50/60 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <div className="flex-1 text-[13px] text-emerald-900"><b>All fields validated.</b> Verified values have been written to the structured database and indexed in the Knowledge Base.</div>
          <Link to="/knowledge" className="btn-success btn-sm">View in Knowledge Base <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
        {/* preview */}
        <section className="card overflow-hidden xl:sticky xl:top-20">
          <div className="card-header">
            <div><h3 className="card-title">Document preview</h3><p className="text-[12px] text-slate-500">Click a highlighted value to inspect it · <span className="text-red-600 font-medium">red</span> needs review · <span className="text-brand-600 font-medium">blue</span> auto-accepted · <span className="text-emerald-600 font-medium">green</span> validated</p></div>
            <div className="hidden 2xl:flex items-center gap-3 text-[11px] text-slate-500 whitespace-nowrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 ring-1 ring-red-400" /> Needs review</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-brand-100 ring-1 ring-brand-300" /> Auto-accepted</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-400" /> Validated</span>
            </div>
          </div>
          <div className="bg-slate-200/60 p-4 sm:p-6 max-h-[calc(100vh-190px)] overflow-y-auto scrollbar-thin">
            <DocumentPreview pages={data.pages} fields={fields} totalPages={doc.pages} scanned={doc.source_kind === 'Scanned'} active={active}
              onPick={(fid) => select(fid, false)} docTitle={doc.title} />
          </div>
        </section>

        {/* fields */}
        <div className="space-y-5">
          <section className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Extracted Information</h3>
                <p className="text-[12px] text-slate-500">{fields.length} key entities · {doc.fields_extracted} fields in total</p>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-semibold tabular-nums text-slate-900">{pct}%</div>
                <div className="text-[11px] text-slate-500">validated</div>
              </div>
            </div>
            <div className="px-4 pt-3">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="bg-emerald-500 transition-all" style={{ width: `${(fields.filter((f) => f.status === 'approved').length / fields.length) * 100}%` }} />
                <div className="bg-brand-400 transition-all" style={{ width: `${(fields.filter((f) => f.status === 'auto_accepted').length / fields.length) * 100}%` }} />
                <div className="bg-amber-400 transition-all" style={{ width: `${(pending.length / fields.length) * 100}%` }} />
              </div>
              <div className="flex gap-1 mt-3 border-b border-slate-100">
                {([['all', `All (${fields.length})`], ['review', `Needs review (${pending.length})`], ['validated', `Validated (${fields.length - pending.length})`]] as [Tab, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={cx('px-3 py-2 text-[12.5px] font-medium border-b-2 -mb-px', tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{l}</button>
                ))}
              </div>
            </div>
            <div className="p-4 space-y-2.5 max-h-[calc(100vh-330px)] overflow-y-auto scrollbar-thin">
              {shown.length === 0 && <EmptyState icon={ShieldCheck} title="Nothing to review" body="All low-confidence fields have been resolved." />}
              {shown.map((f) => (
                <ExtractionField key={f.id + f.status + (f.human_value || '')} field={f} active={active === f.id} canValidate={canValidate} onSelect={() => select(f.id)}
                  onApprove={async () => { update(await api.approveField(f.id), ['Validated ✓', `${f.label} approved and written to verified records.`]); await afterDecision() }}
                  onEdit={async (v, r) => update(await api.editField(f.id, v, r), ['Correction saved', `${f.label} set to ${v}${f.unit ? ' ' + f.unit : ''}. Approve to publish.`])}
                  onReject={async (r) => { update(await api.rejectField(f.id, r)); toast('info', 'Value rejected', `${f.label} excluded from the knowledge base.`); await afterDecision() }}
                />
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h3 className="card-title flex items-center gap-2"><Wand2 className="w-4 h-4 text-slate-500" /> Data Normalization</h3></div>
            <div className="p-4 space-y-2">
              {data.normalization.map((n, i) => (
                <div key={i} className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-[11px] font-medium text-slate-500 mb-1">{n.field}</div>
                  <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{n.original}</code>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">{n.normalized}</code>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{n.rule}</div>
                </div>
              ))}
              <div className="flex gap-2 text-[11.5px] text-slate-500 pt-1"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Units, financial-year formats and OCR artefacts are standardised before values enter the structured database.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
