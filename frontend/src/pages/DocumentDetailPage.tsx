import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpenCheck, Cpu, Database, FileWarning, Layers, Play, RotateCcw, ShieldAlert, Table2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ProcessingPipeline, { STAGE_DEFS } from '../components/ProcessingPipeline'
import StatusBadge from '../components/StatusBadge'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { FileIcon } from '../components/DocumentTable'
import { ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useShellRefresh } from '../layouts/AppLayout'
import type { Stage } from '../types'
import { fileSize, fmtDateTime } from '../utils/format'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function DocumentDetailPage() {
  const { id } = useParams()
  const docId = Number(id)
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const refreshShell = useShellRefresh()
  const { data: doc, error, loading, reload } = useApi(() => api.document(docId), [docId])
  const [stages, setStages] = useState<Stage[] | null>(null)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<Record<string, number | string> | null>(null)
  const started = useRef(false)

  const run = async () => {
    if (running) return
    setRunning(true)
    setSummary(null)
    const pending: Stage[] = STAGE_DEFS.map((d) => ({ key: d.key, name: d.name, status: 'pending', detail: '', duration_ms: 0 }))
    setStages(pending)
    type Result = Awaited<ReturnType<typeof api.process>>
    let result: Result | null = null
    let failure: Error | null = null
    api.process(docId).then((r) => { result = r }).catch((e) => { failure = e })
    const wait = async () => {
      while (!result && !failure) await sleep(100)
      if (failure) throw failure
      return result as unknown as Result
    }
    try {
      // replay the server-side pipeline stage by stage so the officer can follow what happened
      for (let i = 0; i < STAGE_DEFS.length; i++) {
        setStages((prev) => prev!.map((s, j) => (j === i ? { ...s, status: 'running' } : s)))
        await sleep(i === 2 ? 1300 : i === 4 ? 1000 : 750)
        const r = await wait()
        const s = r.stages.find((x) => x.key === STAGE_DEFS[i].key)!
        setStages((prev) => prev!.map((p, j) => (j === i ? s : p)))
        if (s.status === 'failed') {
          setStages(r.stages)
          break
        }
      }
      const r = await wait()
      setSummary(r.summary)
      if (r.status === 'Failed') toast('error', 'Processing failed', 'OCR could not read this document. See the pipeline log for details.')
      else if (r.status === 'Validation Required') toast('warning', 'Extraction complete — review required', `${r.summary.pending} low-confidence field(s) need officer validation.`)
      else toast('success', 'Document processed', 'All fields passed validation and were indexed.')
      reload(true)
      refreshShell()
    } catch (e) {
      toast('error', 'Processing failed', (e as Error).message)
      setStages(null)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (params.get('autoprocess') && doc && !started.current && ['Uploaded', 'Failed'].includes(doc.status) && can('process')) {
      started.current = true
      setParams({}, { replace: true })
      run()
    }
  }, [doc]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !doc) return <LoadingState label="Loading document…" />
  if (error || !doc) return <ErrorState message={error || 'Document not found'} onRetry={reload} />

  const shown = stages || (doc.processing_log?.length ? doc.processing_log : null)
  const canProcess = can('process')
  const done = !running && ['Processed', 'Validation Required', 'Approved'].includes(doc.status)

  return (
    <div className="animate-fade-in">
      <Link to="/documents" className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-brand-600 mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Document Intelligence</Link>
      <PageHeader
        eyebrow={<div className="flex items-center gap-2"><FileIcon type={doc.file_type} className="!w-6 !h-6" /><span className="text-[12px] text-slate-500 font-mono">{doc.filename}</span></div>}
        title={doc.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{doc.category} · {doc.mine} · FY {doc.financial_year} · <StatusBadge status={running ? 'Processing' : doc.status} /></span>}
        actions={<>
          {(doc.status === 'Uploaded' || doc.status === 'Failed') && (
            <button className="btn-primary" onClick={run} disabled={running || !canProcess} title={canProcess ? '' : 'Your role cannot process documents'}>
              {doc.status === 'Failed' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />} {running ? 'Processing…' : doc.status === 'Failed' ? 'Retry processing' : 'Process Document'}
            </button>
          )}
          {done && (
            <button className="btn-primary" onClick={() => nav(`/documents/${doc.id}/extraction`)}>
              {doc.status === 'Validation Required' ? <><ShieldAlert className="w-4 h-4" /> Review extracted data</> : <>View extraction <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
          {done && canProcess && <button className="btn-secondary" onClick={run} disabled={running}><RotateCcw className="w-4 h-4" /> Re-process</button>}
        </>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Processing Pipeline</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">Upload → OCR → Tables → Entities → Validation → Knowledge index</p>
            </div>
            {running && <span className="chip bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20"><Cpu className="w-3 h-3" /> AI engine running</span>}
          </div>
          <div className="p-5">
            {shown ? <ProcessingPipeline stages={shown} /> : (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 grid place-items-center mx-auto mb-3"><Play className="w-5 h-5" /></div>
                <div className="text-[14px] font-semibold text-slate-800">Ready for processing</div>
                <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">The document passed upload validation. Run the pipeline to extract text, tables and entities, score confidence and index it into the knowledge base.</p>
                <button className="btn-primary mt-4" onClick={run} disabled={!canProcess}><Play className="w-4 h-4" /> Process Document</button>
                {!canProcess && <p className="text-[12px] text-slate-500 mt-2">Your role has view-only access.</p>}
              </div>
            )}
          </div>
          {summary && !running && doc.status !== 'Failed' && (
            <div className="mx-5 mb-5 rounded-lg border border-slate-200 bg-slate-50/70 p-4 animate-fade-in">
              <div className="text-[13px] font-semibold text-slate-800 mb-3">Extraction summary</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { i: Layers, l: 'Fields extracted', v: summary.fields }, { i: Table2, l: 'Tables detected', v: summary.tables },
                  { i: Database, l: 'Chunks indexed', v: summary.chunks }, { i: ShieldAlert, l: 'Need review', v: summary.pending },
                ].map(({ i: I, l, v }) => (
                  <div key={l} className="bg-white rounded-md border border-slate-200 p-3">
                    <I className="w-4 h-4 text-slate-400 mb-1" /><div className="text-[18px] font-semibold tabular-nums">{v}</div><div className="text-[11.5px] text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
              <button className="btn-primary mt-4" onClick={() => nav(`/documents/${doc.id}/extraction`)}>
                {Number(summary.pending) > 0 ? 'Review low-confidence fields' : 'View extracted information'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {doc.status === 'Failed' && !running && (
            <div className="mx-5 mb-5 rounded-lg border border-red-200 bg-red-50/60 p-4 flex gap-3">
              <FileWarning className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-[12.5px] text-red-800">
                <div className="font-semibold text-[13px]">Processing failed at OCR stage</div>
                <div className="mt-0.5">{doc.error}</div>
                <div className="mt-2 text-red-700">Recommended: re-scan the original at ≥300 DPI, or route to manual digitisation. The failure has been logged in the audit trail.</div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card">
            <div className="card-header"><h3 className="card-title">Document details</h3></div>
            <dl className="px-5 py-3 text-[12.5px] divide-y divide-slate-100">
              {[
                ['Category', doc.category], ['Mine / Area', doc.mine], ['Financial year', `FY ${doc.financial_year}`], ['Language', doc.language],
                ['Source', `${doc.source_kind} ${doc.file_type.toUpperCase()}`], ['Pages', String(doc.pages)], ['Size', fileSize(doc.size_kb)],
                ['Uploaded by', doc.uploaded_by], ['Uploaded on', fmtDateTime(doc.uploaded_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-slate-800 font-medium text-right">{v}</dd></div>
              ))}
              <div className="flex justify-between gap-4 py-2 items-center"><dt className="text-slate-500">Mean confidence</dt><dd><ConfidenceBadge value={doc.confidence} showBar /></dd></div>
            </dl>
          </section>
          {doc.field_summary.total > 0 && (
            <section className="card">
              <div className="card-header"><h3 className="card-title">Validation status</h3></div>
              <div className="p-5 space-y-2.5 text-[12.5px]">
                {[
                  ['Auto-accepted (≥80%)', doc.field_summary.auto_accepted, 'bg-brand-500'],
                  ['Approved by officer', doc.field_summary.approved, 'bg-emerald-500'],
                  ['Pending review', doc.field_summary.pending, 'bg-amber-500'],
                  ['Rejected', doc.field_summary.rejected, 'bg-red-500'],
                ].map(([l, v, c]) => (
                  <div key={l as string} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${c}`} /><span className="text-slate-600 flex-1">{l}</span><span className="font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
                <Link to={`/documents/${doc.id}/extraction`} className="btn-secondary w-full mt-2"><BookOpenCheck className="w-4 h-4" /> Open extraction & validation</Link>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
