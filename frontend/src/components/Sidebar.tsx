import { NavLink } from 'react-router-dom'
import {
  BarChart3, BookOpenCheck, ClipboardCheck, FileSearch, FileText, LayoutDashboard, MessageSquareText, Network, ScrollText, Server, Settings,
} from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { cx } from '../utils/format'

const NAV = [
  { group: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Data Pipeline', items: [
      { to: '/documents', label: 'Documents', icon: FileSearch },
      { to: '/validation', label: 'Data Validation', icon: ClipboardCheck, badge: 'pending' },
      { to: '/knowledge', label: 'Knowledge Base', icon: BookOpenCheck },
    ],
  },
  {
    group: 'Intelligence', items: [
      { to: '/ai-query', label: 'AI Query', icon: MessageSquareText, perm: 'query_ai' },
      { to: '/topics', label: 'Topic Intelligence', icon: Network },
      { to: '/reports', label: 'Reports', icon: FileText },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'Governance', items: [
      { to: '/audit', label: 'Audit Logs', icon: ScrollText, perm: 'view_audit' },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar({ pending, open, onNavigate }: { pending: number; open: boolean; onNavigate: () => void }) {
  const { can } = useAuth()
  return (
    <aside className={cx(
      'fixed lg:sticky top-0 left-0 z-50 h-screen w-[248px] shrink-0 bg-ink-900 text-slate-300 flex flex-col transition-transform no-print',
      open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    )}>
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
        <Logo size={34} />
        <div className="leading-tight">
          <div className="text-white font-semibold tracking-tight text-[15px]">CoalMind <span className="text-coal-400">AI</span></div>
          <div className="text-[10.5px] text-slate-400">Geological & Mining Intelligence</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-500">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const disabled = 'perm' in it && it.perm && !can(it.perm)
                const Icon = it.icon
                if (disabled) {
                  return (
                    <li key={it.to} title="Not available for your role">
                      <span className="flex items-center gap-3 px-3 h-9 rounded-md text-[13px] text-slate-600 cursor-not-allowed">
                        <Icon className="w-[17px] h-[17px]" /> {it.label}
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={it.to}>
                    <NavLink to={it.to} onClick={onNavigate}
                      className={({ isActive }) => cx(
                        'group flex items-center gap-3 px-3 h-9 rounded-md text-[13px] font-medium transition-colors relative',
                        isActive ? 'bg-white/[.08] text-white' : 'hover:bg-white/[.04] hover:text-white',
                      )}>
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-coal-500" />}
                          <Icon className={cx('w-[17px] h-[17px]', isActive ? 'text-coal-400' : 'text-slate-400 group-hover:text-slate-200')} />
                          <span className="flex-1">{it.label}</span>
                          {'badge' in it && pending > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500/90 text-ink-950 text-[11px] font-semibold grid place-items-center">{pending}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-lg bg-white/[.04] border border-white/5 p-3.5">
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
