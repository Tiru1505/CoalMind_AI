import { NavLink } from 'react-router-dom'
import {
  BarChart3, BookOpenCheck, ClipboardCheck, FileSearch, FileText, LayoutDashboard, MessageSquareText, Network, ScrollText, Server, Settings, ShieldCheck,
} from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { ACCESS } from '../utils/access'
import { cx, ROLE_LABEL } from '../utils/format'

type Item = { to: string; label: string; icon: typeof LayoutDashboard; area?: string; badge?: 'pending' | 'conflicts'; star?: boolean }
const NAV: { group: string; items: Item[] }[] = [
  { group: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Data Pipeline', items: [
      { to: '/documents', label: 'Documents', icon: FileSearch, area: 'documents' },
      { to: '/validation', label: 'Data Validation', icon: ClipboardCheck, area: 'validation', badge: 'pending' },
      { to: '/knowledge', label: 'Knowledge Base', icon: BookOpenCheck, area: 'knowledge' },
    ],
  },
  {
    group: 'Intelligence', items: [
      { to: '/consistency', label: 'Consistency Guard', icon: ShieldCheck, area: 'consistency', badge: 'conflicts', star: true },
      { to: '/ai-query', label: 'AI Query', icon: MessageSquareText, area: 'ai' },
      { to: '/topics', label: 'Topic Intelligence', icon: Network, area: 'topics' },
      { to: '/reports', label: 'Reports', icon: FileText, area: 'reports' },
      { to: '/analytics', label: 'Analytics', icon: BarChart3, area: 'analytics' },
    ],
  },
  {
    group: 'Governance', items: [
      { to: '/audit', label: 'Audit & History', icon: ScrollText, area: 'audit' },
      { to: '/settings', label: 'Settings', icon: Settings, area: 'settings' },
    ],
  },
]

export default function Sidebar({ pending, conflicts, open, onNavigate }: { pending: number; conflicts: number; open: boolean; onNavigate: () => void }) {
  const { user } = useAuth()
  const visible = (it: Item) => !it.area || ACCESS[it.area].includes(user!.role)
  return (
    <aside className={cx(
      'light-scope fixed lg:sticky top-0 left-0 z-50 h-screen w-[248px] shrink-0 bg-ink-900 text-slate-300 flex flex-col transition-transform no-print',
      open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    )}>
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
        <Logo size={34} />
        <div className="leading-tight">
          <div className="text-white font-semibold tracking-tight text-[15px]">CoalMind <span className="text-coal-400">AI</span></div>
          <div className="text-[10.5px] text-slate-400">Geological & Mining Intelligence</div>
        </div>
      </div>
      <div className="mx-3 mt-3 rounded-md bg-[rgba(255,255,255,.04)] border border-white/5 px-3 py-2 text-[11.5px]">
        <div className="text-slate-500 uppercase tracking-wide text-[10px] font-semibold">Signed in as</div>
        <div className="text-slate-200 font-medium">{ROLE_LABEL[user!.role]}</div>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5" aria-label="Main">
        {NAV.map((g) => {
          const items = g.items.filter(visible)
          if (!items.length) return null
          return (
            <div key={g.group}>
              <div className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-500">{g.group}</div>
              <ul className="space-y-0.5">
                {items.map((it) => {
                  const Icon = it.icon
                  const count = it.badge === 'pending' ? pending : it.badge === 'conflicts' ? conflicts : 0
                  return (
                    <li key={it.to}>
                      <NavLink to={it.to} onClick={onNavigate}
                        className={({ isActive }) => cx(
                          'group flex items-center gap-3 px-3 h-9 rounded-md text-[13px] font-medium transition-colors relative',
                          isActive ? 'bg-[rgba(255,255,255,.08)] text-white' : 'hover:bg-[rgba(255,255,255,.04)] hover:text-white',
                        )}>
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-coal-500" />}
                            <Icon className={cx('w-[17px] h-[17px]', isActive ? 'text-coal-400' : 'text-slate-400 group-hover:text-slate-200')} />
                            <span className="flex-1">{it.label}</span>
                            {it.star && count === 0 && <span className="text-[9.5px] font-semibold uppercase tracking-wide text-coal-400">New</span>}
                            {count > 0 && (
                              <span className={cx('min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold grid place-items-center',
                                it.badge === 'conflicts' ? 'bg-red-500 text-white' : 'bg-amber-500/90 text-ink-950')}>{count}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
      <div className="m-3 rounded-lg bg-[rgba(255,255,255,.04)] border border-white/5 p-3.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-500 mb-2">System Status</div>
        <div className="flex items-center gap-2 text-[12.5px] text-slate-200">
          <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-emerald-400" /></span>
          All systems operational
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400"><Server className="w-3.5 h-3.5" /> On-premise · No external API</div>
      </div>
    </aside>
  )
}
