import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, BarChart3, BookOpenCheck, Eye, FileText, Network, Search } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { fmtNum, greeting, surname, timeAgo } from '../utils/format'
import { COLORS, GRID, axisTick, tooltipStyle } from '../utils/chart'

export default function ViewerDashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { data, error, loading, reload } = useApi(api.dashboard)
  const [q, setQ] = useState('')

  if (loading && !data) return <LoadingState label="Loading dashboard…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />
  const h = data.headline
  const search = (e: FormEvent) => { e.preventDefault(); if (q.trim()) nav(`/knowledge?q=${encodeURIComponent(q.trim())}`) }
  const published = data.reports.filter((r) => r.status === 'Approved')

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={<span className="chip bg-slate-100 text-slate-600"><Eye className="w-3 h-3" /> Viewer · read-only access</span>}
        title={`${greeting()}, ${surname(user!.name)}`}
        subtitle="Published performance indicators, approved reports and searchable knowledge."
      />

      <section className="card p-5 mb-5">
        <form onSubmit={search} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-[18px] h-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="input !h-11 pl-11 text-[14px]" placeholder="Search geological, mining or production information…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn-primary !h-11 px-5"><Search className="w-4 h-4" /> Search knowledge</button>
        </form>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { l: `Production ${h?.fy ?? ''}`, v: h ? `${fmtNum(h.production)} MT` : '—' },
          { l: 'Target', v: h ? `${fmtNum(h.target)} MT` : '—' },
          { l: 'Achievement', v: h ? `${h.achievement}%` : '—' },
          { l: 'Mines tracked', v: String(data.mine_wise.length) },
        ].map((t) => (
          <div key={t.l} className="card p-4"><div className="text-[12px] text-slate-500">{t.l}</div><div className="text-[22px] font-semibold tabular-nums mt-1.5 text-slate-900">{t.v}</div></div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        <ChartCard title="Production trend" subtitle="Korba group · MT">
          <div className="h-[240px]">
            <ResponsiveContainer>
              <AreaChart data={data.production_trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs><linearGradient id="vP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.production} stopOpacity={0.22} /><stop offset="100%" stopColor={COLORS.production} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="fy" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[100, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="production" name="Production (MT)" stroke={COLORS.production} strokeWidth={2.5} fill="url(#vP)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Mine-wise production" subtitle={data.mine_wise_fy}>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={data.mine_wise} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="mine" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="production" name="Production (MT)" radius={[4, 4, 0, 0]} maxBarSize={38}>
                  {data.mine_wise.map((m) => <Cell key={m.code} fill={m.achievement >= 100 ? COLORS.green : COLORS.production} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-5">
        <ChartCard title="Published reports" subtitle="Approved for official use" bodyClass="!p-0">
          {published.length === 0 ? <EmptyState icon={FileText} title="No published reports in your workspace yet" body="Approved reports will appear here." /> : (
            <ul className="divide-y divide-slate-100">
              {published.map((r) => (
                <li key={r.id}>
                  <Link to={`/reports?id=${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="flex-1 min-w-0"><span className="block text-[13px] font-medium text-slate-800 truncate">{r.title}</span><span className="block text-[11.5px] text-slate-500">{r.report_no} · {timeAgo(r.created_at)}</span></span>
                    <StatusBadge status={r.status} className="!text-[10.5px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <div className="grid gap-3">
          {[
            { i: BookOpenCheck, t: 'Knowledge Base', d: 'Search verified organisational knowledge', to: '/knowledge' },
            { i: Network, t: 'Topic Intelligence', d: 'Themes, keywords and trends', to: '/topics' },
            { i: BarChart3, t: 'Analytics', d: 'Production, reclamation, safety indicators', to: '/analytics' },
          ].map(({ i: I, t, d, to }) => (
            <Link key={t} to={to} className="card px-4 py-3 flex items-center gap-3 hover:border-brand-300 group">
              <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 grid place-items-center"><I className="w-4 h-4" /></span>
              <span className="flex-1"><span className="block text-[13.5px] font-semibold text-slate-800">{t}</span><span className="block text-[12px] text-slate-500">{d}</span></span>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
