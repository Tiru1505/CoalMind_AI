import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpenCheck, Boxes, Database, FileStack, Loader2, Search, SearchX, ShieldCheck, Table2, Tags } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import SourceViewer, { type SourceRef } from '../components/SourceViewer'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import type { SearchResult } from '../types'
import { cx, fmtInt, timeAgo } from '../utils/format'
import { tooltipStyle } from '../utils/chart'

const EXAMPLES = ['Production of Gevra mine in FY 2024-25', 'Land reclamation progress', 'Coal production target', 'Overburden removal', 'Geological reserves Kusmunda', 'कोयला उत्पादन']

export default function KnowledgeBasePage() {
  const { data: stats, error, loading, reload } = useApi(api.knowledgeStats)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ query: string; items: SearchResult[]; interpreted: { mines: string[]; financial_year: string | null } } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [source, setSource] = useState<SourceRef | null>(null)
  const [params] = useSearchParams()
  useEffect(() => {
    const initial = params.get('q')
    if (initial) search(initial)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (text: string, vo = verifiedOnly) => {
    const t = text.trim()
    if (!t) return
    setQ(t)
    setSearching(true)
    setSearchErr(null)
    try {
      const r = await api.knowledgeSearch(t, vo)
      setResults({ query: t, items: r.results, interpreted: r.interpreted })
    } catch (e) {
      setSearchErr((e as Error).message)
    } finally {
      setSearching(false)
    }
  }
  const onSubmit = (e: FormEvent) => { e.preventDefault(); search(q) }

  if (loading && !stats) return <LoadingState label="Loading knowledge base…" />
  if (error || !stats) return <ErrorState message={error || 'No data'} onRetry={reload} />

  const tiles = [
    { l: 'Documents indexed', v: stats.documents_indexed, i: FileStack },
    { l: 'Knowledge chunks', v: stats.knowledge_chunks, i: Boxes },
    { l: 'Entities', v: stats.entities, i: Tags },
    { l: 'Tables', v: stats.tables, i: Table2 },
    { l: 'Verified records', v: stats.verified_records, i: ShieldCheck },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="Knowledge Base" subtitle="Verified organizational knowledge extracted from historical and current documents." />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
        {tiles.map(({ l, v, i: I }) => (
          <div key={l} className="card p-4">
            <div className="flex items-center justify-between text-[12px] text-slate-500">{l}<I className="w-4 h-4 text-slate-400" /></div>
            <div className="text-[22px] font-semibold tabular-nums mt-2 text-slate-900">{fmtInt(v)}</div>
          </div>
        ))}
      </div>

      <section className="card p-5 mb-5">
        <form onSubmit={onSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-[18px] h-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="input !h-11 pl-11 text-[14px]" placeholder="Search geological, mining or production information..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Semantic search" />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-slate-600 px-1 select-none cursor-pointer">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => { setVerifiedOnly(e.target.checked); if (results) search(results.query, e.target.checked) }} className="w-4 h-4 rounded border-slate-300 text-brand-600" />
            Verified only
          </label>
          <button className="btn-primary !h-11 px-5" disabled={searching}>{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search</button>
        </form>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-[12px] text-slate-500">Try:</span>
          {EXAMPLES.map((e) => <button key={e} onClick={() => search(e)} className="chip bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition">{e}</button>)}
        </div>
        <div className="text-[11.5px] text-slate-400 mt-3">Hybrid semantic search · {stats.embedding_model} · {stats.vector_store}</div>
      </section>

      {searchErr && <div className="mb-5"><ErrorState message={searchErr} onRetry={() => search(q)} /></div>}

      {results && (
        <section className="card mb-5 animate-fade-in">
          <div className="card-header">
            <div>
              <h3 className="card-title">{results.items.length} result{results.items.length !== 1 && 's'} for “{results.query}”</h3>
              <p className="text-[12px] text-slate-500">
                Interpreted: {results.interpreted.mines.length ? `mine = ${results.interpreted.mines.join(', ')}` : 'all mines'}
                {results.interpreted.financial_year && ` · FY ${results.interpreted.financial_year}`}
              </p>
            </div>
          </div>
          {results.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No matching knowledge found" body="No indexed passage matched this query. Try different terms, a mine name, or a financial year." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.items.map((r) => (
                <li key={r.chunk_id} className="px-5 py-4 hover:bg-slate-50/60">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-slate-800">{r.document_title}</span>
                        <span className="text-[12px] text-slate-500">· page {r.page} · {r.section}</span>
                      </div>
                      <div className="mt-1.5 text-[13px] text-slate-700 bg-yellow-50/70 border-l-2 border-yellow-400 pl-3 py-1 font-serif">{r.snippet}</div>
                      <div className="flex flex-wrap gap-2 mt-2 text-[11.5px]">
                        <span className="chip bg-slate-100 text-slate-600">FY {r.financial_year}</span>
                        <span className="chip bg-slate-100 text-slate-600">{r.mine}</span>
                        {r.verified ? <span className="chip bg-emerald-50 text-emerald-700"><ShieldCheck className="w-3 h-3" /> Verified</span> : <span className="chip bg-amber-50 text-amber-800">Pending validation</span>}
                        <span className="chip bg-slate-100 text-slate-500 font-mono">{r.filename}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">Relevance</div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${r.relevance}%` }} /></div>
                          <span className="text-[12.5px] font-semibold tabular-nums">{r.relevance}%</span>
                        </div>
                      </div>
                      <button className="btn-secondary btn-sm" onClick={() => setSource({ document_id: r.document_id, page: r.page, snippet: r.snippet, relevance: r.relevance, extraction_confidence: r.extraction_confidence })}>View source</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChartCard title="Indexed library by category" subtitle="Documents in the demo knowledge base">
          <div className="h-[230px]">
            <ResponsiveContainer>
              <BarChart data={stats.by_category} layout="vertical" margin={{ left: 40, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11.5, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" name="Documents" fill="#1e4e79" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Historical coverage" subtitle="Documents by financial year — old reports become searchable knowledge">
          <div className="h-[230px]">
            <ResponsiveContainer>
              <BarChart data={stats.by_year} margin={{ left: -20 }}>
                <XAxis dataKey="fy" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" name="Documents" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Recently added knowledge" bodyClass="!p-0">
          <ul className="divide-y divide-slate-100">
            {stats.recent_additions.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <Link to={`/documents/${d.id}/extraction`} className="text-[13px] font-medium text-slate-800 hover:text-brand-700 line-clamp-1">{d.title}</Link>
                <div className="flex items-center gap-2 mt-1 text-[11.5px] text-slate-500">
                  <StatusBadge status={d.status} className="!text-[10.5px]" />
                  <span className={cx(d.verified_chunks === d.chunks ? 'text-emerald-700' : 'text-amber-700')}>{d.verified_chunks}/{d.chunks} chunks verified</span>
                  <span>· {timeAgo(d.uploaded_at)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 border-t border-slate-100 text-[11.5px] text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> {stats.demo_library.verified_chunks} of {stats.demo_library.chunks} demo chunks verified · AI Query uses verified chunks only
          </div>
        </ChartCard>
      </div>
      <div className="mt-4 text-[11.5px] text-slate-400 flex items-center gap-1.5"><BookOpenCheck className="w-3.5 h-3.5" /> Headline totals include the organisation-wide archive; the demo library contains the individually indexed sample documents.</div>

      <SourceViewer source={source} onClose={() => setSource(null)} />
    </div>
  )
}
