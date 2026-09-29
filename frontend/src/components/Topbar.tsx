import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, ChevronDown, History, Info, LayoutDashboard, LogOut, Menu, RotateCcw, Settings, XCircle } from 'lucide-react'
import SearchBar from './SearchBar'
import Modal from './Modal'
import ThemeToggle from './ThemeToggle'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Notification } from '../types'
import { cx, ROLE_LABEL, timeAgo } from '../utils/format'

const N_ICON = { warning: AlertTriangle, info: Info, success: CheckCircle2, error: XCircle }
const N_TONE = { warning: 'text-amber-600 bg-amber-50', info: 'text-brand-600 bg-brand-50', success: 'text-emerald-600 bg-emerald-50', error: 'text-red-600 bg-red-50' }

function useOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb() }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [ref, cb])
}

export default function Topbar({ notifications, onMenu }: { notifications: Notification[]; onMenu: () => void }) {
  const { user, logout, can } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [nOpen, setNOpen] = useState(false)
  const [uOpen, setUOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetAll, setResetAll] = useState(false)
  const [resetting, setResetting] = useState(false)
  const seenKey = `cm.seen.${user?.id}`
  const [seen, setSeen] = useState<string[]>(() => JSON.parse(sessionStorage.getItem(seenKey) || '[]'))
  const nRef = useRef<HTMLDivElement>(null)
  const uRef = useRef<HTMLDivElement>(null)
  useOutside(nRef, () => setNOpen(false))
  useOutside(uRef, () => setUOpen(false))

  const unread = notifications.filter((n) => !seen.includes(n.id)).length
  const markAll = () => {
    const ids = notifications.map((n) => n.id)
    setSeen(ids)
    sessionStorage.setItem(seenKey, JSON.stringify(ids))
  }

  const reset = async () => {
    setResetting(true)
    try {
      await api.resetDemo(resetAll ? 'all' : 'mine')
      sessionStorage.setItem('cm.flash', resetAll ? 'All workspaces were rebuilt from the demo dataset.' : 'Your workspace was reset — the Gevra OC FY 2024-25 report is ready to process.')
      sessionStorage.removeItem(seenKey)
      sessionStorage.removeItem(`cm.chat.${user?.id}`)
      if (resetAll) { await logout(); window.location.assign('/login') } else window.location.assign(user!.dashboard)
    } catch (e) {
      toast('error', 'Could not load demo scenario', (e as Error).message)
      setResetting(false)
    }
  }

  if (!user) return null
  const initials = user.name.replace(/^(Dr|Mr|Ms)\.\s*/i, '').split(' ').map((p) => p[0]).slice(0, 2).join('')

  return (
    <header className="sticky top-0 z-40 h-16 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 lg:px-6 no-print">
      <button className="btn-ghost !px-2 lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu className="w-5 h-5" /></button>
      <SearchBar />
      <div className="flex-1" />

      <span className="hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap chip bg-coal-50 text-coal-700 ring-1 ring-inset ring-coal-600/20" title="All AI runs locally with deterministic demo services">
        <span className="w-1.5 h-1.5 rounded-full bg-coal-500" /> Demo Mode
      </span>
      {can('reset_demo') && (
        <button className="btn-secondary hidden md:inline-flex" onClick={() => { setResetAll(false); setResetOpen(true) }}>
          <RotateCcw className="w-3.5 h-3.5" /> Load Demo Scenario
        </button>
      )}
      <ThemeToggle />

      <div ref={nRef} className="relative">
        <button className="btn-ghost !px-2 relative" aria-label="Notifications" onClick={() => setNOpen((o) => !o)}>
          <Bell className="w-[18px] h-[18px]" />
          {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold grid place-items-center">{unread}</span>}
        </button>
        {nOpen && (
          <div className="absolute right-0 top-11 w-[380px] bg-white border border-slate-200 rounded-lg shadow-pop z-50 animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-[13.5px] font-semibold">Notifications</span>
              <button className="text-[12px] text-brand-600 hover:underline" onClick={markAll}>Mark all as read</button>
            </div>
            <ul className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-slate-500">You're all caught up.</li>}
              {notifications.map((n) => {
                const Icon = N_ICON[n.type]
                return (
                  <li key={n.id}>
                    <button onClick={() => { setNOpen(false); setSeen((s) => [...s, n.id]); nav(n.link) }}
                      className={cx('w-full flex gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100', !seen.includes(n.id) && 'bg-brand-50/30')}>
                      <span className={cx('w-8 h-8 rounded-full grid place-items-center shrink-0', N_TONE[n.type])}><Icon className="w-4 h-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-slate-800">{n.title}</span>
                        <span className="block text-[12px] text-slate-500 truncate">{n.body}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">{timeAgo(n.time)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <div ref={uRef} className="relative">
        <button onClick={() => setUOpen((o) => !o)} className="flex items-center gap-2.5 pl-2 pr-1.5 h-10 rounded-md hover:bg-slate-100" aria-label="User menu">
          <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-[12px] font-semibold grid place-items-center">{initials}</span>
          <span className="hidden md:block text-left leading-tight whitespace-nowrap">
            <span className="block text-[13px] font-semibold text-slate-800">{user.name}</span>
            <span className="block text-[11.5px] text-slate-500">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
        {uOpen && (
          <div className="absolute right-0 top-12 w-[280px] bg-white border border-slate-200 rounded-lg shadow-pop z-50 animate-fade-in overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-[13px] font-semibold">{user.name}</div>
              <div className="text-[12px] text-slate-500">{user.mobile} · {user.employee_id}</div>
              <div className="text-[12px] text-slate-500">{user.department}</div>
              <span className="mt-2 chip bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20">Role: {ROLE_LABEL[user.role]}</span>
              <p className="text-[11px] text-slate-400 mt-2">Your role is fixed for this session. Sign out to sign in with another role.</p>
            </div>
            <div className="py-1.5">
              {[
                { i: LayoutDashboard, l: 'My dashboard', to: user.dashboard },
                { i: History, l: 'My activity history', to: '/audit' },
                { i: Settings, l: 'Settings', to: '/settings' },
              ].map(({ i: I, l, to }) => (
                <button key={l} onClick={() => { setUOpen(false); nav(to) }} className="w-full flex items-center gap-2 px-4 py-2 text-[13px] hover:bg-slate-50">
                  <I className="w-4 h-4 text-slate-500" /> {l}
                </button>
              ))}
              {can('manage_users') && (
                <button onClick={() => { setUOpen(false); setResetAll(true); setResetOpen(true) }} className="w-full flex items-center gap-2 px-4 py-2 text-[13px] hover:bg-slate-50">
                  <RotateCcw className="w-4 h-4 text-slate-500" /> Rebuild all workspaces
                </button>
              )}
            </div>
            <div className="border-t border-slate-100 py-1.5">
              <button onClick={async () => { await logout(); nav('/login') }} className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-700 hover:bg-red-50"><LogOut className="w-4 h-4" /> Sign out</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} size="sm" title={resetAll ? 'Rebuild every workspace?' : 'Load demo scenario?'}
        footer={<>
          <button className="btn-secondary" onClick={() => setResetOpen(false)}>Cancel</button>
          <button className={resetAll ? 'btn-danger' : 'btn-primary'} disabled={resetting} onClick={reset}>
            <RotateCcw className={cx('w-3.5 h-3.5', resetting && 'animate-spin')} /> {resetting ? 'Loading…' : resetAll ? 'Rebuild all' : 'Reset my workspace'}
          </button>
        </>}>
        <div className="px-5 py-4 text-[13px] text-slate-600 space-y-2">
          {resetAll ? (
            <p>This drops the demo database and rebuilds the four demo accounts. <b>All users (including newly registered ones) are removed</b> and everyone is signed out.</p>
          ) : (
            <>
              <p>This resets <b>only your own workspace</b> to the SIH demonstration state. Other users' data is not affected.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>17 sample documents, verified production & geological records</li>
                <li><b>Gevra OCP Production Report FY 2024-25</b> uploaded and ready to process</li>
                <li>Validation queue, Consistency Guard conflicts, reports and history restored</li>
              </ul>
            </>
          )}
          <p className="text-[12px] text-slate-500">All values are sample data, not official CIL figures.</p>
        </div>
      </Modal>
    </header>
  )
}
