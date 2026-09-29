import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, FileDown, FileSpreadsheet, Info, Printer } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import FilterDropdown from '../components/FilterDropdown'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { cx, fmtInt, fmtNum } from '../utils/format'
import { COLORS, GRID, axisTick, tooltipStyle } from '../utils/chart'

export default function AnalyticsPage() {
  const [params] = useSearchParams()
  const { can } = useAuth()
  const toast = useToast()
  const [subsidiary, setSubsidiary] = useState('')
  const [mine, setMine] = useState(params.get('mine') || '')
  const [fy, setFy] = useState('2024-25')
  const [view, setView] = useState('all')
  const { data, error, loading, reload } = useApi(() => api.analytics({ subsidiary, mine, fy }), [subsidiary, mine, fy])

  const exp = async (format: 'csv' | 'xlsx') => {
    try {
      await api.exportAnalytics(format, { subsidiary, mine, fy: view === 'all' ? 'all' : fy })
      toast('success', `Exported ${format.toUpperCase()}`, 'The file has been downloaded. The export is recorded in the audit trail.')
    } catch (e) { toast('error', 'Export failed', (e as Error).message) }
  }

  if (loading && !data) return <LoadingState label="Computing analytics…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />

  const yearly = view === 'verified' ? data.yearly.filter((y) => !y.provisional) : data.yearly
  const s = data.summary
  const mineOpts = data.options.mines.filter((m) => !subsidiary || m.subsidiary === subsidiary)

  const kpis = s ? [
    { l: 'Coal production', v: `${fmtNum(s.production)} MT`, d: s.deltas.production },
    { l: 'Target achievement', v: `${fmtNum(s.achievement)}%`, d: null, sub: `Target ${fmtNum(s.target)} MT` },
    { l: 'Overburden removal', v: `${fmtNum(s.overburden)} Mm³`, d: s.deltas.overburden },
    { l: 'Land reclaimed', v: `${fmtInt(s.land)} ha`, d: s.deltas.land },
    { l: 'Manpower', v: fmtInt(s.manpower), d: s.deltas.manpower },
    { l: 'Safety incidents', v: String(s.safety), d: s.deltas.safety, invert: true },
  ] : []

  return (
    <div className="animate-fade-in">
      <PageHeader title="Analytics" subtitle="Production, overburden, reclamation, manpower and safety performance from verified records."
        actions={<>
          <button className="btn-secondary" disabled={!can('export')} onClick={() => exp('csv')}><FileDown className="w-4 h-4" /> Export CSV</button>
          <button className="btn-secondary" disabled={!can('export')} onClick={() => exp('xlsx')}><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Export PDF</button>
        </>} />

      <section className="card px-5 py-4 mb-5 flex flex-wrap gap-4 items-end no-print">
        <FilterDropdown label="Subsidiary" value={subsidiary} onChange={(v) => { setSubsidiary(v); setMine('') }} allLabel="All subsidiaries" options={data.options.subsidiaries.map((x) => ({ value: x, label: x }))} />
        <FilterDropdown label="Mine" value={mine} onChange={setMine} allLabel="All mines" options={mineOpts.map((m) => ({ value: m.code, label: m.name }))} />
        <FilterDropdown label="Financial year" value={fy} onChange={setFy} allLabel={null} options={data.options.financial_years.map((f) => ({ value: f, label: `FY ${f}${f === '2025-26' ? ' (P)' : ''}` }))} />
        <FilterDropdown label="Report type" value={view} onChange={setView} allLabel={null} options={[{ value: 'all', label: 'Annual + provisional MIS' }, { value: 'verified', label: 'Verified annual reports only' }]} />
        <div className="flex-1" />
        {(subsidiary || mine) && <button className="btn-ghost btn-sm" onClick={() => { setSubsidiary(''); setMine('') }}>Reset filters</button>}
      </section>

      {!s ? <div className="card"><EmptyState title="No records for this selection" body="Try another mine or financial year." /></div> : (
        <div id="print-area">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
            {kpis.map((k) => (
              <div key={k.l} className="card p-4">
                <div className="text-[12px] text-slate-500">{k.l}</div>
                <div className="text-[20px] font-semibold tabular-nums mt-1.5 text-slate-900">{k.v}</div>
                {k.d != null ? (
                  <div className={cx('text-[11.5px] font-medium mt-1 flex items-center', (k.invert ? k.d <= 0 : k.d >= 0) ? 'text-emerald-700' : 'text-red-700')}>
                    {k.d >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{Math.abs(k.d)}% <span className="text-slate-400 font-normal ml-1">vs prev. FY</span>
                  </div>
                ) : <div className="text-[11.5px] text-slate-400 mt-1">{k.sub}</div>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
            <ChartCard title="Production" subtitle="Coal production vs target (MT)">
              <div className="h-[260px]"><ResponsiveContainer>
                <AreaChart data={yearly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs><linearGradient id="aP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.production} stopOpacity={0.2} /><stop offset="100%" stopColor={COLORS.production} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="fy" tick={axisTick} axisLine={false} tickLine={false} /><YAxis tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="production" name="Production (MT)" stroke={COLORS.production} strokeWidth={2.5} fill="url(#aP)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="target" name="Target (MT)" stroke={COLORS.target} strokeDasharray="5 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer></div>
            </ChartCard>
            <ChartCard title="Target vs Achievement" subtitle={`Mine-wise · FY ${fy}`}>
              <div className="h-[260px]"><ResponsiveContainer>
                <ComposedChart data={data.by_mine.map((m) => ({ ...m, short: m.mine.replace(' OC', '') }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="short" tick={{ ...axisTick, fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis yAxisId="a" domain={[85, 110]} ticks={[85, 90, 95, 100, 105, 110]} tick={axisTick} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} labelFormatter={(_, p) => p?.[0]?.payload?.mine ?? ''} />
                  <ReferenceLine yAxisId="a" y={100} stroke={COLORS.achievement} strokeDasharray="4 4" label={{ value: 'Target', fontSize: 10.5, fill: COLORS.achievement, position: 'insideTopRight' }} />
                  <Bar yAxisId="a" dataKey="achievement" name="Achievement" radius={[4, 4, 0, 0]} maxBarSize={34}>
                    {data.by_mine.map((m) => <Cell key={m.code} fill={m.achievement >= 100 ? COLORS.green : COLORS.production} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer></div>
            </ChartCard>
            <ChartCard title="Overburden" subtitle="OB removal (Mm³) and stripping ratio (m³/t)">
              <div className="h-[260px]"><ResponsiveContainer>
                <ComposedChart data={yearly} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="fy" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ob" tick={axisTick} axisLine={false} tickLine={false} /><YAxis yAxisId="sr" orientation="right" domain={[2, 4.5]} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="ob" dataKey="overburden" name="OB removal (Mm³)" fill="#78716c" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line yAxisId="sr" type="monotone" dataKey="stripping_ratio" name="Stripping ratio" stroke={COLORS.achievement} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer></div>
            </ChartCard>
            <ChartCard title="Land Reclamation" subtitle={`Hectares reclaimed · FY ${fy} by mine`}>
              <div className="h-[260px]"><ResponsiveContainer>
                <BarChart data={[...data.by_mine].sort((a, b) => b.land - a.land)} layout="vertical" margin={{ top: 4, right: 16, left: 30, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="mine" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ha`} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="land" name="Land reclaimed" fill={COLORS.green} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer></div>
            </ChartCard>
            <ChartCard title="Manpower" subtitle="Workforce and output per man-shift (OMS, t)">
              <div className="h-[260px]"><ResponsiveContainer>
                <ComposedChart data={yearly} margin={{ top: 8, right: 0, left: -4, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="fy" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="m" tick={axisTick} axisLine={false} tickLine={false} domain={['auto', 'auto']} /><YAxis yAxisId="o" orientation="right" tick={axisTick} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="m" dataKey="manpower" name="Manpower" fill={COLORS.violet} fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line yAxisId="o" type="monotone" dataKey="oms" name="OMS (t)" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer></div>
            </ChartCard>
            <ChartCard title="Safety" subtitle="Reportable incidents per year (no fatal accidents recorded)">
              <div className="h-[260px]"><ResponsiveContainer>
                <BarChart data={yearly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="fy" tick={axisTick} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="safety" name="Reportable incidents" fill={COLORS.red} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer></div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-5">
            <ChartCard title="Production forecast" subtitle="Linear trend projection (illustrative only)">
              <div className="h-[250px]"><ResponsiveContainer>
                <ComposedChart data={data.forecast} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="fy" tick={{ ...axisTick, fontSize: 10.5 }} axisLine={false} tickLine={false} /><YAxis tick={axisTick} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="actual" name="Actual (MT)" fill={COLORS.production} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Line type="monotone" dataKey="forecast" name="Forecast (MT)" stroke={COLORS.achievement} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer></div>
            </ChartCard>
            <ChartCard title="Mine comparison" subtitle={`FY ${fy}`} bodyClass="!p-0">
              <div className="overflow-x-auto">
                <table className="table-base min-w-[640px]">
                  <thead><tr><th>Mine</th><th className="text-right">Prod. (MT)</th><th className="text-right">Target</th><th className="text-right">Ach.</th><th className="text-right">OB (Mm³)</th><th className="text-right">SR</th><th className="text-right">Land (ha)</th><th className="text-right">OMS</th></tr></thead>
                  <tbody>
                    {data.by_mine.map((m) => (
                      <tr key={m.code}>
                        <td className="font-medium">{m.mine} <span className="text-[11px] text-slate-400">{m.subsidiary}</span></td>
                        <td className="text-right tabular-nums">{m.production}</td><td className="text-right tabular-nums text-slate-500">{m.target}</td>
                        <td className={cx('text-right tabular-nums font-medium', m.achievement >= 100 ? 'text-emerald-700' : 'text-amber-700')}>{m.achievement}%</td>
                        <td className="text-right tabular-nums">{m.overburden}</td><td className="text-right tabular-nums">{m.stripping_ratio}</td>
                        <td className="text-right tabular-nums">{m.land}</td><td className="text-right tabular-nums">{m.oms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
          <p className="mt-4 text-[11.5px] text-slate-400 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> {data.note}</p>
        </div>
      )}
    </div>
  )
}
