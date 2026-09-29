import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSearch, Filter, Search } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DocumentUpload from '../components/DocumentUpload'
import DocumentTable from '../components/DocumentTable'
import FilterDropdown from '../components/FilterDropdown'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useShellRefresh } from '../layouts/AppLayout'
import { cx } from '../utils/format'

const STATUSES = ['Uploaded', 'Processed', 'Validation Required', 'Approved', 'Failed']

export default function DocumentsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const refreshShell = useShellRefresh()
  const { data, error, loading, reload } = useApi(() => api.documents())
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [justUploaded, setJustUploaded] = useState<number | null>(null)

  const docs = useMemo(() => (data || []).filter((d) =>
    (!status || d.status === status) && (!type || d.file_type === type) &&
    (!q || `${d.title} ${d.filename} ${d.mine} ${d.category} ${d.financial_year}`.toLowerCase().includes(q.toLowerCase()))), [data, q, status, type])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of data || []) c[d.status] = (c[d.status] || 0) + 1
    return c
  }, [data])

  return (
    <div className="animate-fade-in">
      <PageHeader title="Document Intelligence" subtitle="Upload, process and manage geological, mining and production records." />

      <section className="card p-5 mb-5">
        <DocumentUpload disabled={!can('upload')} onUploaded={(d) => {
          toast('success', 'Document uploaded', `${d.filename} is queued. Open it to run the extraction pipeline.`)
          setJustUploaded(d.id)
          reload(true)
          refreshShell()
        }} />
        {justUploaded && (
          <div className="mt-3 flex justify-end">
            <button className="btn-primary btn-sm" onClick={() => nav(`/documents/${justUploaded}?autoprocess=1`)}>Process uploaded document now</button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-[240px]">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Search library</span>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input pl-9" placeholder="Filter by title, mine, category or year…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <FilterDropdown label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: `${s} (${counts[s] || 0})` }))} allLabel="All statuses" />
          <FilterDropdown label="File type" value={type} onChange={setType} options={['pdf', 'xlsx', 'docx', 'jpg', 'png'].map((t) => ({ value: t, label: t.toUpperCase() }))} allLabel="All types" />
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          {['', ...STATUSES].map((s) => (
            <button key={s || 'all'} onClick={() => setStatus(s)}
              className={cx('chip ring-1 ring-inset transition', status === s ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300')}>
              {s || 'All'} <span className="opacity-70">{s ? counts[s] || 0 : data?.length || 0}</span>
            </button>
          ))}
        </div>
        {loading && !data ? <div className="p-5"><LoadingState rows={6} /></div>
          : error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div>
          : docs.length === 0 ? <EmptyState icon={q || status || type ? Filter : FileSearch} title="No documents match your filters" body="Try clearing the search or status filter." action={<button className="btn-secondary btn-sm" onClick={() => { setQ(''); setStatus(''); setType('') }}>Clear filters</button>} />
          : <DocumentTable docs={docs} highlightId={justUploaded} />}
        <div className="px-5 py-3 text-[12px] text-slate-500 border-t border-slate-100">
          Showing {docs.length} of {data?.length || 0} documents in the demo library · The organisation-wide archive (1,248+ documents) is represented by aggregate counts on the dashboard.
        </div>
      </section>
    </div>
  )
}
