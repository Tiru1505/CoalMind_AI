import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Factory, FileText, Gauge, Leaf, MessageSquareText, Mountain, Send, ShieldAlert } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import ConsistencyCard from '../components/ConsistencyCard'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { fmtNum, greeting, surname, timeAgo } from '../utils/format'
import { COLORS, GRID, axisTick, tooltipStyle } from '../utils/chart'

export default function ManagementDashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { data, error, loading, reload } = useApi(api.dashboard)
  const [q, setQ] = useState('')

  if (loading && !data) return <LoadingState label="Loading executive overview…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />

  const h = data.headline
  const mines = data.mine_wise
  const land = mines.reduce((s, m) => s + m.land, 0)
  const ob = mines.reduce((s, m) => s + m.overburden, 0)
  const incidents = mines.reduce((s, m) => s + m.safety, 0)
  const above = mines.filter((m) => m.achievement >= 100).length
  const ask = (e: FormEvent) => { e.preventDefault(); if (q.trim()) nav(`/ai-query?q=${encodeURIComponent(q.trim())}`) }
  const drafts = data.reports.filter((r) => r.status === 'Draft')

  const tiles = [
    { i: Factory, l: `Coal production ${h?.fy ?? ''}`, v: h ? `${fmtNum(h.production)} MT` : '—', s: h ? `Target ${fmtNum(h.target)} MT` : '' },
    { i: Gauge, l: 'Target achievement', v: h ? `${h.achievement}%` : '—', s: `${above} of ${mines.length} mines at or above target`, warn: h && h.achievement < 100 },
    { i: Mountain, l: 'Overburden removal', v: `${fmtNum(ob)} Mm³`, s: 'Korba group' },
    { i: Leaf, l: 'Land reclaimed', v: `${land} ha`, s: 'Technical + biological' },
    { i: ShieldAlert, l: 'Reportable incidents', v: String(incidents), s: 'No fatal accidents' },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={<span className="chip bg-brand-50 text-brand-700">Management · Executive overview</span>}
        title={`${greeting()}, ${surname(user!.name)}`}
        subtitle="Verified performance of the Korba group, open data-quality risks and reports awaiting your decision."
        actions={<>
          <Link to="/reports" className="btn-secondary"><FileText className="w-4 h-4" /> Reports</Link>
          <Link to="/analytics" className="btn-primary">Full analytics <ArrowRight className="w-4 h-4" /></Link>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
        {tiles.map(({ i: I, l, v, s, warn }) => (
          <div key={l} className="card p-4">
            <div className="flex items-center justify-between text-[12px] text-slate-500">{l}<I className="w-4 h-4 text-slate-400" /></div>
            <div className={`text-[22px] font-semibold tabular-nums mt-2 ${warn ? 'text-amber-700' : 'text-slate-900'}`}>{v}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5 mb-5">
        <ChartCard title="Production vs target" subtitle="Korba group · MT · FY 2025-26 provisional">
          <div className="h-[270px]">
            <ResponsiveContainer>
              <ComposedChart data={data.production_trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="fy" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[100, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="production" name="Production (MT)" fill={COLORS.production} radius={[4, 4, 0, 0]} maxBarSize={42} />
                <Line type="monotone" dataKey="target" name="Target (MT)" stroke={COLORS.achievement} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Target achievement by mine" subtitle={data.mine_wise_fy}>
          <div className="h-[270px]">
            <ResponsiveContainer>
              <BarChart data={mines} layout="vertical" margin={{ top: 4, right: 24, left: 18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" domain={[85, 110]} ticks={[85, 90, 95, 100, 105, 110]} tick={axisTick} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="mine" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <ReferenceLine x={100} stroke={COLORS.achievement} strokeDasharray="4 4" />
                <Bar dataKey="achievement" name="Achievement" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {mines.map((m) => <Cell key={m.code} fill={m.achievement >= 100 ? COLORS.green : COLORS.production} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-5">
        <div className="space-y-5">
          <ConsistencyCard c={data.consistency} />
          <section className="card p-5">
            <h3 className="card-title flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-slate-500" /> Ask CoalMind AI</h3>
            <p className="text-[12.5px] text-slate-500 mt-0.5">Answers come only from verified data, with citations and a cross-source check.</p>
            <form onSubmit={ask} className="flex gap-2 mt-3">
              <input className="input" placeholder="e.g. Which mines exceeded their production targets?" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn-primary !px-3" aria-label="Ask"><Send className="w-4 h-4" /></button>
            </form>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {['Which mines exceeded their production targets?', 'Prepare a summary of Gevra mine.', 'What was the land reclamation progress in 2025?'].map((s) => (
                <button key={s} onClick={() => nav(`/ai-query?q=${encodeURIComponent(s)}`)} className="chip bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700">{s}</button>
              ))}
            </div>
          </section>
        </div>
        <ChartCard title="Reports" subtitle={drafts.length ? `${drafts.length} draft${drafts.length > 1 ? 's' : ''} awaiting approval` : 'Your recent reports'}
          action={<Link to="/reports" className="text-[12.5px] text-brand-600 hover:underline">Report Studio</Link>} bodyClass="!p-0">
          {data.reports.length === 0 ? <EmptyState icon={FileText} title="No reports yet" body="Generate an executive summary or ministry brief in Report Studio." /> : (
            <ul className="divide-y divide-slate-100">
              {data.reports.map((r) => (
                <li key={r.id}>
                  <Link to={`/reports?id=${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-slate-800 truncate">{r.title}</span>
                      <span className="block text-[11.5px] text-slate-500">{r.report_no} · {timeAgo(r.created_at)}</span>
                    </span>
                    <StatusBadge status={r.status} className="!text-[10.5px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
