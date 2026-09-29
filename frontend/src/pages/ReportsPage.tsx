import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Download, FileText, History, Loader2, Printer, ShieldCheck, Wand2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ReportPreview from '../components/ReportPreview'
import SourceViewer, { type SourceRef } from '../components/SourceViewer'
import StatusBadge from '../components/StatusBadge'
import FilterDropdown from '../components/FilterDropdown'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useShellRefresh } from '../layouts/AppLayout'
import type { ReportItem } from '../types'
import { cx, timeAgo } from '../utils/format'

const STEPS = ['Retrieving verified data', 'Checking source records', 'Validating figures', 'Generating report']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function ReportsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const refreshShell = useShellRefresh()
  const [params, setParams] = useSearchParams()
  const { data: opts, error, loading, reload } = useApi(api.reportOptions)
  const { data: list, reload: reloadList } = useApi(api.reports)
  const [form, setForm] = useState({ report_type: 'Annual Mining Report', scope: 'GEV', financial_year: '2024-25', month: 'March', date_range: '', query_text: '' })
  const [sections, setSections] = useState<string[]>(['executive_summary', 'production', 'geological', 'mining_performance', 'environment', 'land_reclamation', 'key_observations'])
  const [step, setStep] = useState(-1)
  const [report, setReport] = useState<ReportItem | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [source, setSource] = useState<SourceRef | null>(null)

  useEffect(() => {
    const id = params.get('id')
    if (id) api.report(Number(id)).then(setReport).catch(() => toast('error', 'Report not found'))
  }, [params, toast])

  const generating = step >= 0 && step < STEPS.length
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const dateRange = form.report_type === 'Monthly Production Report' ? `${form.month} ${form.month && ['January', 'February', 'March'].includes(form.month) ? '20' + form.financial_year.slice(5) : form.financial_year.slice(0, 4)}` : `Apr ${form.financial_year.slice(0, 4)} – Mar 20${form.financial_year.slice(5)}`

  const generate = async () => {
    setFormErr(null)
    if (!sections.length) { setFormErr('Select at least one section.'); return }
    if (form.report_type === 'Parliamentary Query Response' && form.query_text.trim().length < 5) { setFormErr('Enter the subject of the parliamentary question.'); return }
    setReport(null)
    setParams({}, { replace: true })
    setStep(0)
    try {
      const req = api.generateReport({ ...form, date_range: dateRange, sections })
      for (let i = 0; i < STEPS.length; i++) { setStep(i); await sleep(650) }
      const r = await req
      setStep(STEPS.length)
      await sleep(350)
      setReport(r)
      reloadList(true)
      refreshShell()
      toast('success', 'Report ready', `${r.report_no} generated as a draft for officer review.`)
    } catch (e) {
      setStep(-1)
      setFormErr((e as Error).message)
    }
  }

  const approve = async () => {
    if (!report) return
    try {
      const r = await api.approveReport(report.id)
      setReport(r)
      reloadList(true)
      toast('success', 'Report approved', 'The draft watermark has been replaced with the approval record.')
    } catch (e) { toast('error', 'Approval failed', (e as Error).message) }
  }

  const cite = (ref: number) => {
    const r = report?.content?.references.find((x) => x.ref === ref)
    if (r) setSource({ document_id: r.document_id, page: r.page, validation_status: r.status })
  }

  if (loading && !opts) return <LoadingState label="Loading Report Studio…" />
  if (error || !opts) return <ErrorState message={error || 'No data'} onRetry={reload} />
  const canGen = can('generate_reports')

  return (
    <div className="animate-fade-in">
      <PageHeader title="Report Studio" subtitle="Generate structured reports from verified information — every figure traceable to its source." />

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5 items-start">
        <div className="space-y-5 no-print">
          <section className="card">
            <div className="card-header"><h3 className="card-title flex items-center gap-2"><Wand2 className="w-4 h-4 text-slate-500" /> Report parameters</h3></div>
            <div className="p-4 space-y-3.5">
              <FilterDropdown label="Report type" value={form.report_type} onChange={(v) => set('report_type', v)} allLabel={null} options={opts.report_types.map((t) => ({ value: t, label: t }))} />
              <FilterDropdown label="Mine / Subsidiary" value={form.scope} onChange={(v) => set('scope', v)} allLabel={null} options={opts.scopes.map((s) => ({ value: s.code, label: s.name }))} />
              <div className="grid grid-cols-2 gap-3">
                <FilterDropdown label="Financial year" value={form.financial_year} onChange={(v) => set('financial_year', v)} allLabel={null} options={opts.financial_years.map((f) => ({ value: f, label: `FY ${f}` }))} />
                {form.report_type === 'Monthly Production Report'
                  ? <FilterDropdown label="Month" value={form.month} onChange={(v) => set('month', v)} allLabel={null} options={opts.months.map((m) => ({ value: m, label: m }))} />
                  : <label className="flex flex-col gap-1"><span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date range</span><input className="input text-[12px]" value={dateRange} readOnly aria-readonly /></label>}
              </div>
              {form.report_type === 'Parliamentary Query Response' && (
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Question subject</span>
                  <textarea className="input !h-auto py-2 mt-1" rows={2} maxLength={300} placeholder="e.g. coal production and land reclamation in Korba district"
                    value={form.query_text} onChange={(e) => set('query_text', e.target.value)} />
                </label>
              )}
              <fieldset>
                <legend className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">Sections</legend>
                <div className="space-y-1">
                  {opts.sections.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 text-[13px] text-slate-700 py-1 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600" checked={sections.includes(s.id)}
                        onChange={(e) => setSections((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              {formErr && <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formErr}</div>}
              <button className="btn-primary w-full !h-10" onClick={generate} disabled={generating || !canGen}>
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><FileText className="w-4 h-4" /> Generate Report</>}
              </button>
              {!canGen && <p className="text-[12px] text-slate-500">Your role can view reports but not generate them.</p>}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h3 className="card-title flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /> Generated reports</h3></div>
            {!list?.length ? <EmptyState title="No reports yet" /> : (
              <ul className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto scrollbar-thin">
                {list.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => api.report(r.id).then(setReport)} className={cx('w-full text-left px-4 py-2.5 hover:bg-slate-50', report?.id === r.id && 'bg-brand-50/60')}>
                      <div className="text-[12.5px] font-medium text-slate-800 line-clamp-1">{r.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500"><StatusBadge status={r.status} className="!text-[10.5px]" /><span className="font-mono">{r.report_no}</span><span>· {timeAgo(r.created_at)}</span></div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="min-w-0">
          {step >= 0 && !report && (
            <div className="card p-8 max-w-xl mx-auto mt-6 no-print">
              <div className="text-[15px] font-semibold text-slate-800 mb-4">Generating {form.report_type.toLowerCase()}…</div>
              <ul className="space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s} className={cx('flex items-center gap-3 text-[13.5px]', i <= step ? 'text-slate-800' : 'text-slate-400')}>
                    {i < step ? <span className="w-6 h-6 rounded-full bg-emerald-600 text-white grid place-items-center"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>
                      : i === step ? <span className="w-6 h-6 rounded-full bg-brand-600 text-white grid place-items-center"><Loader2 className="w-3.5 h-3.5 animate-spin" /></span>
                      : <span className="w-6 h-6 rounded-full border-2 border-slate-200" />}
                    {s}… {i < step && <span className="text-emerald-700 font-medium">✓</span>}
                  </li>
                ))}
                {step >= STEPS.length && <li className="flex items-center gap-3 text-[13.5px] font-semibold text-emerald-700"><ShieldCheck className="w-6 h-6" /> Report ready.</li>}
              </ul>
            </div>
          )}
          {!report && step < 0 && (
            <div className="card no-print"><EmptyState icon={FileText} title="No report selected" body="Choose parameters and click Generate Report, or open a previously generated report from the list." /></div>
          )}
          {report && (
            <div className="animate-fade-in">
              <div className="card mb-4 px-4 py-3 flex flex-wrap items-center gap-2 no-print">
                <StatusBadge status={report.status} />
                <span className="text-[12.5px] text-slate-600 font-mono">{report.report_no}</span>
                <span className="text-[12.5px] text-slate-500">· generated by {report.generated_by}</span>
                <div className="flex-1" />
                {report.status === 'Draft' && can('approve_reports') && <button className="btn-success btn-sm" onClick={approve}><ShieldCheck className="w-3.5 h-3.5" /> Approve for official use</button>}
                <button className="btn-secondary btn-sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print / Save PDF</button>
                <button className="btn-secondary btn-sm" onClick={() => api.downloadReport(report.id, report.report_no.replace(/\//g, '_')).catch((e) => toast('error', 'Download failed', e.message))}><Download className="w-3.5 h-3.5" /> Download</button>
              </div>
              <div className="bg-slate-200/60 rounded-lg p-4 sm:p-8"><ReportPreview report={report} onCite={cite} /></div>
            </div>
          )}
        </section>
      </div>
      <SourceViewer source={source} onClose={() => setSource(null)} />
    </div>
  )
}
