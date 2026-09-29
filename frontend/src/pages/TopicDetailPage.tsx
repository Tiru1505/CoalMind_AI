import { Link, useNavigate, useParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ArrowUpRight, FileStack, Layers, MessageSquareText, Mountain } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { fmtDate, fmtInt } from '../utils/format'
import { tooltipStyle } from '../utils/chart'

const ASK: Record<string, string> = {
  'production-output': 'Which mines exceeded their production targets?',
  'land-reclamation': 'What was the land reclamation progress in 2025?',
  'geological-exploration': 'What are the geological reserves of Gevra?',
  'safety-compliance': 'How many safety incidents were reported at Gevra in FY 2024-25?',
  environment: 'dust suppression measures at Gevra',
  'manpower-productivity': 'What was the manpower of Gevra OC Mine in FY 2024-25?',
}

export default function TopicDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { data: t, error, loading, reload } = useApi(() => api.topic(id), [id])

  if (loading && !t) return <LoadingState label="Loading topic…" />
  if (error || !t) return <ErrorState message={error || 'Topic not found'} onRetry={reload} />
  const yearly = Object.entries(t.yearly).map(([year, v]) => ({ year, documents: v }))
  const max = Math.max(...t.keywords.map((k) => k.weight))

  return (
    <div className="animate-fade-in">
      <Link to="/topics" className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-brand-600 mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Topic Intelligence</Link>
      <PageHeader
        eyebrow={<span className="chip text-white" style={{ background: t.color }}>Topic</span>}
        title={t.name} subtitle={t.description}
        actions={<button className="btn-primary" onClick={() => nav(`/ai-query?q=${encodeURIComponent(ASK[t.slug] || t.name)}`)}><MessageSquareText className="w-4 h-4" /> Ask AI about this topic</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="card p-4"><div className="text-[12px] text-slate-500 flex items-center gap-1.5"><FileStack className="w-3.5 h-3.5" /> Documents</div><div className="text-[24px] font-semibold tabular-nums mt-1">{fmtInt(t.document_count)}</div></div>
        <div className="card p-4"><div className="text-[12px] text-slate-500">Trend (YoY)</div><div className="text-[24px] font-semibold text-emerald-700 flex items-center mt-1"><ArrowUpRight className="w-5 h-5" />+{t.trend_pct}%</div></div>
        <div className="card p-4"><div className="text-[12px] text-slate-500 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Indexed chunks (demo)</div><div className="text-[24px] font-semibold tabular-nums mt-1">{t.indexed_chunks}</div></div>
        <div className="card p-4"><div className="text-[12px] text-slate-500 flex items-center gap-1.5"><Mountain className="w-3.5 h-3.5" /> Related mines</div><div className="text-[24px] font-semibold tabular-nums mt-1">{t.related_mines?.length}</div></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <ChartCard className="xl:col-span-2" title="Document frequency" subtitle="Documents tagged with this topic per year">
          <div className="h-[240px]">
            <ResponsiveContainer>
              <AreaChart data={yearly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs><linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.color} stopOpacity={0.25} /><stop offset="100%" stopColor={t.color} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="documents" name="Documents" stroke={t.color} strokeWidth={2.5} fill="url(#gT)" dot={{ r: 3.5, fill: t.color }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Important keywords" subtitle="c-TF-IDF weight">
          <ul className="space-y-2.5">
            {t.keywords.map((k) => (
              <li key={k.term}>
                <div className="flex justify-between text-[12.5px]"><span className="text-slate-700">{k.term}</span><span className="tabular-nums text-slate-500">{k.weight}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100 mt-1"><div className="h-full rounded-full" style={{ width: `${(k.weight / max) * 100}%`, background: t.color }} /></div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChartCard title="Extracted statistics" subtitle="Computed from verified records · FY 2024-25">
          <dl className="grid grid-cols-2 gap-3">
            {t.statistics?.map((s) => (
              <div key={s.label} className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2.5">
                <dt className="text-[11.5px] text-slate-500">{s.label}</dt><dd className="text-[16px] font-semibold text-slate-900 mt-0.5">{s.value}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
        <ChartCard title="Related mines">
          <ul className="space-y-2">
            {t.related_mines?.map((m) => (
              <li key={m.code}>
                <Link to={`/analytics?mine=${m.code}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:border-brand-300 text-[13px]">
                  <span className="flex items-center gap-2"><Mountain className="w-4 h-4 text-slate-400" />{m.name}</span><span className="text-[11.5px] text-slate-500">{m.subsidiary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Recent documents" bodyClass="!p-0">
          {!t.recent_documents?.length ? <EmptyState title="No documents in the demo library" /> : (
            <ul className="divide-y divide-slate-100">
              {t.recent_documents.map((d) => (
                <li key={d.id} className="px-4 py-2.5">
                  <Link to={`/documents/${d.id}`} className="text-[13px] font-medium text-slate-800 hover:text-brand-700 line-clamp-1">{d.title}</Link>
                  <div className="flex items-center gap-2 mt-1 text-[11.5px] text-slate-500"><StatusBadge status={d.status} className="!text-[10.5px]" /> FY {d.financial_year} · {fmtDate(d.uploaded_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
      <p className="mt-4 text-[11.5px] text-slate-400">{t.model}</p>
    </div>
  )
}
