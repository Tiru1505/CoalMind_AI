import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Notification } from '../types'

/** Lets pages tell the shell that server state changed (badge counts, notifications). */
const RefreshCtx = createContext<() => void>(() => {})
export const useShellRefresh = () => useContext(RefreshCtx)

export default function AppLayout() {
  const { user } = useAuth()
  const toast = useToast()
  const loc = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState(0)

  const refresh = useCallback(() => {
    api.notifications().then((r) => { setNotifications(r.items); setPending(r.pending_validation); setConflicts(r.open_conflicts) }).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh, loc.pathname, user?.id])
  useEffect(() => {
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [refresh])
  useEffect(() => {
    const flash = sessionStorage.getItem('cm.flash')
    if (flash) {
      sessionStorage.removeItem('cm.flash')
      toast('success', flash.startsWith('Welcome') ? 'Account created' : 'Demo scenario ready', flash)
    }
  }, [toast])
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  return (
    <RefreshCtx.Provider value={refresh}>
      <div className="min-h-screen flex">
        <Sidebar pending={pending} conflicts={conflicts} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {menuOpen && <div className="fixed inset-0 bg-ink-950/40 z-40 lg:hidden" onClick={() => setMenuOpen(false)} />}
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar notifications={notifications} onMenu={() => setMenuOpen(true)} />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto">
            <Outlet key={user?.id} />
          </main>
          <footer className="px-8 py-4 text-[11.5px] text-slate-400 border-t border-slate-200 bg-white/60 flex flex-wrap gap-x-6 gap-y-1 no-print">
            <span>CoalMind AI v1.1 · SIH 2026 · PS 26023 · Team Tubelights</span>
            <span>Prototype with sample demonstration data — not official CIL / CMPDI figures</span>
          </footer>
        </div>
      </div>
    </RefreshCtx.Provider>
  )
}
