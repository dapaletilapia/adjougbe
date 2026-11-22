import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { get, post } from './api'

export type User = {
  id: number
  email: string
  full_name: string
  phone: string
  country: string
  city: string
  birth_date: string | null
  role: 'reader' | 'admin' | 'editor' | 'accountant' | 'assistant'
  is_staff_role: boolean
  is_superuser?: boolean
  deletion_requested_at?: string | null
  email_verified: boolean
  newsletter_consent: boolean
  preferences: string[]
  otp_enabled: boolean
  otp_verified: boolean
  date_joined: string
}

type AuthState = {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<{ otp_required: boolean; closed_devices: { label: string; last_seen_at: string }[] }>
  logout: () => Promise<void>
  setUser: (u: User | null) => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await get<{ user: User | null }>('/api/auth/me/')
      setUser(r.user)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email: string, password: string) => {
    const r = await post<{ user: User; otp_required: boolean; closed_devices?: { label: string; last_seen_at: string }[] }>('/api/auth/login/', { email, password })
    setUser(r.user)
    return { otp_required: r.otp_required, closed_devices: r.closed_devices ?? [] }
  }
  const logout = async () => {
    await post('/api/auth/logout/')
    setUser(null)
  }
  return <Ctx.Provider value={{ user, loading, refresh, login, logout, setUser }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth hors AuthProvider')
  return ctx
}
