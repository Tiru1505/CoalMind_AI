import { Link, useNavigate } from 'react-router-dom'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Activity, ArrowRight, BookMarked, CheckCircle2, ClipboardCheck, Cpu, FileCheck2, FileSearch, Gauge, MessageSquareText, PlayCircle, ScrollText, ShieldCheck, Upload,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { fmtInt, greeting, surname, timeAgo } from '../utils/format'
import { tooltipStyle } from '../utils/chart'

const KPI_ICON = { documents: FileCheck2, fields: Cpu, pending: ClipboardCheck, reports: BookMarked, queries: MessageSquareText, accuracy: Gauge }
const KPI_LINK: Record<string, string> = { documents: '/documents', pending: '/validation', reports: '/reports', queries: '/ai-query', fields: '/knowledge', accuracy: '/audit' }
const PIE_COLORS = ['#1e4e79', '#94a3b8', '#d97706', '#dc2626']
const CAT_ICON: Record<string, typeof Activity> = { upload: Upload, processing: Cpu, validation: ShieldCheck, ai: MessageSquareText, report: BookMarked, system: Activity }

export default function DashboardPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { data, error, loading, reload } = useApi(api.dashboard)

  if (loading && !data) return <LoadingState label="Loading intelligence overview…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />

  const total = data.document_status.reduce((s, d) => s + d.value, 0)
  const demo = data.demo_document

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`${greeting()}, ${surname(user!.name)}`}
        subtitle="Here is the current intelligence overview across your mining data."
        actions={<>
          <Link to="/documents" className="btn-secondary"><Upload className="w-4 h-4" /> Upload document</Link>
          <Link to="/ai-query" className="btn-primary"><MessageSquareText className="w-4 h-4" /> Ask CoalMind AI</Link>
        </>}
      />

      {demo && demo.status === 'Uploaded' && (
        <div className="card mb-5 p-4 flex flex-wrap items-center gap-4 border-brand-200 bg-gradient-to-r from-brand-50/80 to-white">
          <div className="w-10 h-10 rounded-lg bg-brand-600 text-white grid place-items-center"><PlayCircle className="w-5 h-5" /></div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-[13.5px] font-semibold text-slate-800">New document awaiting processing</div>
            <div className="text-[12.5px] text-slate-600">{demo.title} was uploaded a few minutes ago. Run the extraction pipeline to add it to the knowledge base.</div>
          </div>
          <button onClick={() => nav(`/documents/${demo.id}`)} className="btn-primary">Open & process <ArrowRight className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
        {data.kpis.map((k) => (
          <KpiCard key={k.key} label={k.label} value={k.value} suffix={k.suffix} delta={k.delta} note={k.note} tone={k.tone}
            icon={KPI_ICON[k.key as keyof typeof KPI_ICON]} onClick={() => nav(KPI_LINK[k.key])} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <ChartCard className="xl:col-span-2" title="Production Trend — Korba Group (SECL)" subtitle="Coal production vs target (MT) and achievement (%) · FY 2025-26 provisional"
          action={<Link to="/analytics" className="text-[12.5px] text-brand-600 hover:underline">View analytics</Link>}>
          <div className="h-[290px]">
            <ResponsiveContainer>
              <ComposedChart data={data.production_trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e4e79" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#1e4e79" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="fy" tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="mt" tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[100, 'auto']} unit="" />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[90, 104]} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => (n === 'Achievement' ? `${v}%` : `${v} MT`)} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="mt" type="monotone" dataKey="production" name="Coal Production" stroke="#1e4e79" strokeWidth={2.5} fill="url(#gProd)" dot={{ r: 3.5, fill: '#1e4e79' }} />
                <Line yAxisId="mt" type="monotone" dataKey="target" name="Target" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line yAxisId="pct" type="monotone" dataKey="achievement" name="Achievement" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: '#d97706' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Document Processing" subtitle={`${fmtInt(total)} documents in the pipeline`}>
          <div className="h-[200px] relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.document_status} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
                  {data.document_status.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtInt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="text-[22px] font-semibold text-slate-900 tabular-nums">{Math.round((data.document_status[0].value / total) * 100)}%</div>
                <div className="text-[11px] text-slate-500">processed</div>
              </div>
            </div>
          </div>
          <ul className="mt-2 space-y-1.5">
            {data.document_status.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 text-slate-600"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />{d.name}</span>
                <span className="font-medium tabular-nums text-slate-800">{fmtInt(d.value)}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChartCard className="xl:col-span-2" title="Mine-wise Production" subtitle={`${data.mine_wise_fy} · production vs target (MT)`}>
          <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={data.mine_wise} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="mine" tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }}
                  formatter={(v: number, n: string) => [`${v} MT`, n]}
                  labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.achievement ?? ''}% of target`} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="production" name="Production" radius={[4, 4, 0, 0]} maxBarSize={38}>
                  {data.mine_wise.map((m) => <Cell key={m.code} fill={m.achievement >= 100 ? '#15803d' : '#1e4e79'} />)}
                </Bar>
                <Bar dataKey="target" name="Target" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11.5px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#15803d]" /> Target exceeded</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1e4e79]" /> Below target</span>
          </div>
        </ChartCard>

        <ChartCard title="Recent Activity" action={<Link to="/audit" className="text-[12.5px] text-brand-600 hover:underline">Audit trail</Link>} bodyClass="!p-0">
          <ul className="divide-y divide-slate-100">
            {data.recent_activity.map((a) => {
              const Icon = CAT_ICON[a.category] || ScrollText
              return (
                <li key={a.id} className="px-4 py-3 flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 grid place-items-center shrink-0 mt-0.5"><Icon className="w-3.5 h-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-slate-800"><span className="font-medium">{a.action}</span></div>
                    <div className="text-[11.5px] text-slate-500 truncate">{a.document || a.source}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-400">{a.user} · {timeAgo(a.timestamp)}</span>
                    </div>
                  </div>
                  <StatusBadge status={a.status} className="self-start !text-[10.5px]" />
                </li>
              )
            })}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {[
          { icon: FileSearch, t: 'Reporting', d: 'Structured reports assembled from verified records, with draft/approval workflow.', to: '/reports' },
          { icon: Activity, t: 'Topic Intelligence', d: 'Emerging themes, keywords and trends across the document archive.', to: '/topics' },
          { icon: MessageSquareText, t: 'AI Query', d: 'Natural-language questions answered only from verified, cited sources.', to: '/ai-query' },
        ].map(({ icon: I, t, d, to }) => (
          <Link key={t} to={to} className="card p-4 flex gap-3 hover:border-brand-300 transition group">
            <span className="w-9 h-9 rounded-md bg-ink-900 text-coal-400 grid place-items-center shrink-0"><I className="w-4 h-4" /></span>
            <span>
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-800">{t} <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>
              <span className="block text-[12.5px] text-slate-500 mt-0.5">{d}</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 ml-auto self-center shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
