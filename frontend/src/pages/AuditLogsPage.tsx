import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Download, Fingerprint, Lock, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import AuditTable from '../components/AuditTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import type { AuditEntry } from '../types'
import { cx, fmtDateTime, fmtTime } from '../utils/format'

const CATS = [['', 'All events'], ['upload', 'Uploads'], ['processing', 'AI processing'], ['validation', 'Validation'], ['ai', 'AI queries'], ['report', 'Reports'], ['auth', 'Access'], ['system', 'System']]

export default function AuditLogsPage() {
  const { can } = useAuth()
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<AuditEntry | null>(null)
  const { data, error, loading, reload } = useApi(() => api.auditLogs({ category: cat }), [cat])
  const rows = useMemo(() => (data || []).filter((r) => !q || `${r.user} ${r.action} ${r.document} ${r.status} ${r.source}`.toLowerCase().includes(q.toLowerCase())), [data, q])

  if (!can('view_audit')) {
    return <div className="card"><EmptyState icon={Lock} title="Access restricted" body="Audit logs are available to Administrators, Geological Officers and Management." /></div>
  }

  const exportCsv = () => {
    const head = ['Timestamp', 'User', 'Role', 'Action', 'Document', 'Status', 'Source']
    const lines = rows.map((r) => [fmtDateTime(r.timestamp), r.user, r.role, r.action, r.document, r.status, r.source].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'coalmind_audit_trail.csv'
    a.click()
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Audit & Traceability" subtitle="Every upload, AI extraction, human validation, AI answer and report is recorded — every important AI decision is traceable."
        actions={<>
          <button className="btn-secondary" onClick={() => reload()}><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button className="btn-secondary" onClick={exportCsv}><Download className="w-4 h-4" /> Export</button>
        </>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {[
          { i: Fingerprint, t: 'Immutable event log', d: 'Append-only records with user, role, timestamp and source.' },
          { i: Bot, t: 'AI decisions explained', d: 'Model, confidence and source page stored with every extraction.' },
          { i: ShieldCheck, t: 'Human accountability', d: 'Original, AI and corrected values retained for each validation.' },
        ].map(({ i: I, t, d }) => (
          <div key={t} className="card p-4 flex gap-3"><span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 grid place-items-center shrink-0"><I className="w-4 h-4" /></span><div><div className="text-[13px] font-semibold">{t}</div><div className="text-[12px] text-slate-500">{d}</div></div></div>
        ))}
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-slate-100">
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(([k, l]) => (
              <button key={k} onClick={() => setCat(k)} className={cx('chip ring-1 ring-inset', cat === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300')}>{l}</button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input pl-9" placeholder="Filter by user, action, document…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {loading && !data ? <div className="p-5"><LoadingState rows={8} /></div>
          : error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div>
          : rows.length === 0 ? <EmptyState title="No audit events match" />
          : <AuditTable rows={rows} onSelect={setSel} selectedId={sel?.id} />}
        <div className="px-5 py-3 text-[12px] text-slate-500 border-t border-slate-100">{rows.length} events · click a row for full traceability details</div>
      </section>

      <AuditDetail entry={sel} onClose={() => setSel(null)} />
    </div>
  )
}

function AuditDetail({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const { data } = useApi(() => (entry ? api.auditLog(entry.id) : Promise.resolve(null)), [entry?.id])
  if (!entry) return null
  const d = entry.details as Record<string, unknown>
  const has = (k: string) => d[k] !== undefined && d[k] !== null && d[k] !== ''
  const trace = [
    ['Original value (OCR)', d.original_value], ['AI extracted value', d.ai_value], ['Human corrected value', d.human_value],
  ] as [string, unknown][]
  const showTrace = has('ai_value')
  return (
    <Modal open onClose={onClose} size="lg" title={entry.action} subtitle={<span className="flex items-center gap-2">{fmtDateTime(entry.timestamp)} · <StatusBadge status={entry.status} /></span>}>
      <div className="p-5 space-y-5">
        {showTrace && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Value lineage</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch">
              {trace.map(([k, v], i) => (
                <div key={k} className={cx('rounded-lg border p-3 relative', i === 2 && v ? 'border-violet-300 bg-violet-50' : i === 1 ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-slate-50')}>
                  <div className="text-[11px] text-slate-500">{k}</div>
                  <div className="font-mono text-[14px] font-semibold text-slate-900 mt-0.5">{v ? String(v) : <span className="text-slate-400 font-sans font-normal text-[12.5px]">No correction</span>}</div>
                  {i < 2 && <ArrowRight className="hidden sm:block w-4 h-4 text-slate-300 absolute -right-3 top-1/2 -translate-y-1/2 bg-white rounded-full" />}
                </div>
              ))}
            </div>
          </div>
        )}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 text-[13px]">
          {([
            ['User', `${entry.user} (${entry.role})`], ['Timestamp', fmtDateTime(entry.timestamp)], ['Document', entry.document || '—'], ['Source', entry.source || '—'],
            ...(has('source_page') ? [['Source page', `Page ${d.source_page}`]] : []),
            ...(has('model') ? [['Model / process', String(d.model)]] : []),
            ...(has('field') ? [['Field', String(d.field)]] : []),
            ...(has('question') ? [['Question', String(d.question)]] : []),
            ...(has('intent') ? [['Detected intent', String(d.intent)]] : []),
            ...(has('reason') ? [['Reason', String(d.reason)]] : []),
            ...(has('error') ? [['Error', String(d.error)]] : []),
            ...(has('report_no') ? [['Report no.', String(d.report_no)]] : []),
            ...(has('latency_ms') ? [['Latency', `${d.latency_ms} ms`]] : []),
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2 border-b border-slate-100"><dt className="text-slate-500 shrink-0">{k}</dt><dd className="font-medium text-right break-words min-w-0">{v}</dd></div>
          ))}
          {has('confidence') && <div className="flex justify-between gap-4 py-2 border-b border-slate-100 items-center"><dt className="text-slate-500">Confidence</dt><dd><ConfidenceBadge value={Number(d.confidence)} showLabel /></dd></div>}
        </dl>
        {Array.isArray(d.sources) && d.sources.length > 0 && (
          <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Cited sources</div>
            <ul className="text-[12.5px] font-mono text-slate-700 space-y-1">{(d.sources as string[]).map((s) => <li key={s}>• {s}</li>)}</ul></div>
        )}
        {has('write_back') && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12.5px] text-emerald-900">
            Verified value written to <code>{(d.write_back as { table: string; column: string }).table}.{(d.write_back as { column: string }).column}</code> (previous: {String((d.write_back as { before: unknown }).before)} → {String((d.write_back as { after: unknown }).after)})
          </div>
        )}
        {entry.document_id && (
          <div className="flex gap-2">
            <Link to={`/documents/${entry.document_id}/extraction`} className="btn-secondary btn-sm" onClick={onClose}>Open document <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        )}
        {data?.related && data.related.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Document history</div>
            <ol className="relative border-l border-slate-200 ml-2 space-y-2.5">
              {data.related.map((r) => (
                <li key={r.id} className="ml-4 text-[12.5px]">
                  <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-slate-400 tabular-nums mr-2">{fmtTime(r.timestamp)}</span><span className="text-slate-800">{r.action}</span> <span className="text-slate-500">· {r.user}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Modal>
  )
}
