import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, CheckCircle2, Database, FileStack, KeyRound, MessageSquareText, ScrollText, ServerCog, UserCheck, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { cx, fmtInt, greeting, ROLE_LABEL, surname, timeAgo } from '../utils/format'
import { COLORS, GRID, axisTick, tooltipStyle } from '../utils/chart'

const ROLE_COLORS: Record<string, string> = { admin: '#6d28d9', geological_officer: '#1e4e79', management: '#d97706', viewer: '#64748b' }

export default function AdminDashboard() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi(api.adminOverview)

  if (loading && !data) return <LoadingState label="Loading administrator console…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />
  const k = data.kpis

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={<span className="chip bg-violet-50 text-violet-700">Administrator console</span>}
        title={`${greeting()}, ${surname(user!.name)}`}
        subtitle="Users, isolated workspaces, platform health and the organisation-wide audit trail."
        actions={<Link to="/audit" className="btn-primary"><ScrollText className="w-4 h-4" /> Organisation audit trail</Link>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
        {[
          { i: Users, l: 'Registered users', v: k.users, s: `${k.active_24h} active in last 24 h` },
          { i: Database, l: 'User workspaces', v: k.workspaces, s: 'Isolated datasets' },
          { i: FileStack, l: 'Documents (all)', v: k.documents, s: `${fmtInt(k.chunks)} indexed chunks` },
          { i: MessageSquareText, l: 'AI queries (all)', v: k.queries, s: `${k.reports} reports generated` },
          { i: KeyRound, l: 'OTP sign-ins (24 h)', v: k.sign_ins_24h, s: `${k.failed_otp_24h} failed attempts`, warn: k.failed_otp_24h > 0 },
          { i: AlertTriangle, l: 'Failed processing', v: k.failed, s: 'Needs re-scan', warn: k.failed > 0 },
        ].map(({ i: I, l, v, s, warn }) => (
          <div key={l} className="card p-4">
            <div className="flex items-center justify-between text-[12px] text-slate-500">{l}<I className="w-4 h-4 text-slate-400" /></div>
            <div className="text-[24px] font-semibold tabular-nums mt-2 text-slate-900">{fmtInt(v)}</div>
            <div className={cx('text-[11.5px] mt-0.5', warn ? 'text-amber-700' : 'text-slate-500')}>{s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5 mb-5">
        <ChartCard title="Users & workspaces" subtitle="Each user works in an isolated dataset with their own history" bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="table-base min-w-[760px]">
              <thead><tr><th>User</th><th>Role</th><th>Mobile</th><th className="text-right">Documents</th><th className="text-right">Queries</th><th className="text-right">Reports</th><th>Last sign-in</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td><div className="font-medium text-slate-800">{u.name}</div><div className="text-[11px] text-slate-400">{u.employee_id} · joined {timeAgo(u.created_at)}</div></td>
                    <td><span className="chip text-white whitespace-nowrap" style={{ background: ROLE_COLORS[u.role] }}>{ROLE_LABEL[u.role]}</span></td>
                    <td className="font-mono text-[12px] text-slate-600 whitespace-nowrap">{u.mobile}</td>
                    <td className="text-right tabular-nums">{u.processed}/{u.documents}</td>
                    <td className="text-right tabular-nums">{u.queries}</td>
                    <td className="text-right tabular-nums">{u.reports}</td>
                    <td className="text-slate-500 text-[12px] whitespace-nowrap">{u.last_login ? timeAgo(u.last_login) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title="Platform services" subtitle="Health of the on-premise AI stack">
          <ul className="space-y-2.5">
            {data.services.map((s) => (
              <li key={s.name} className="flex items-start gap-3 text-[12.5px]">
                {s.status === 'operational' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <ServerCog className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{s.name}</div>
                  <div className="text-slate-500 truncate" title={s.detail}>{s.detail}</div>
                </div>
                <span className={cx('chip !text-[10.5px] capitalize', s.status === 'operational' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>{s.status}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChartCard title="Activity (8 days)" subtitle="Audit events and AI queries across all users" className="xl:col-span-1">
          <div className="h-[230px]">
            <ResponsiveContainer>
              <BarChart data={data.activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tick={{ ...axisTick, fontSize: 10.5 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="events" name="Events" fill={COLORS.production} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="queries" name="AI queries" fill={COLORS.achievement} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Users by role">
          <div className="h-[170px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.by_role} dataKey="value" nameKey="role" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                  {data.by_role.map((r) => <Cell key={r.role} fill={ROLE_COLORS[r.role]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [v, ROLE_LABEL[n]]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 mt-2 text-[12px]">
            {data.by_role.map((r) => (
              <li key={r.role} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ROLE_COLORS[r.role] }} />{ROLE_LABEL[r.role]} <b className="ml-auto">{r.value}</b></li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Recent activity — all users" bodyClass="!p-0" action={<Link to="/audit" className="text-[12.5px] text-brand-600 hover:underline">View all</Link>}>
          <ul className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto scrollbar-thin">
            {data.recent.map((a) => (
              <li key={a.id} className="px-4 py-2.5 flex gap-2.5">
                {a.category === 'auth' ? <UserCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <Activity className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-slate-800 truncate">{a.action}</div>
                  <div className="text-[11px] text-slate-500">{a.user} · {timeAgo(a.timestamp)}</div>
                </div>
                <StatusBadge status={a.status} className="!text-[10px] self-start" />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  )
}
