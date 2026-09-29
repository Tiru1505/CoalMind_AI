import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  ready: boolean
  login: (id: string, pw: string, remember: boolean) => Promise<void>
  completeLogin: (token: string, user: User, remember: boolean) => void
  logout: () => Promise<void>
  can: (permission: string) => boolean
  sessionExpired: boolean
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear()
      setUser((u) => {
        if (u) setSessionExpired(true)
        return null
      })
    })
    if (!tokenStore.get()) {
      setReady(true)
      return
    }
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setReady(true))
  }, [])

  const login = useCallback(async (id: string, pw: string, remember: boolean) => {
    const res = await api.login(id, pw)
    tokenStore.set(res.token, remember)
    setSessionExpired(false)
    setUser(res.user)
  }, [])

  const completeLogin = useCallback((token: string, u: User, remember: boolean) => {
    tokenStore.set(token, remember)
    sessionStorage.removeItem('cm.chat')
    setSessionExpired(false)
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    tokenStore.clear()
    setUser(null)
  }, [])

  const can = useCallback((p: string) => !!user?.permissions.includes(p), [user])

  return <Ctx.Provider value={{ user, ready, login, completeLogin, logout, can, sessionExpired }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
