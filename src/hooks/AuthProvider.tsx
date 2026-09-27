import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api/auth'
import { UNAUTHORIZED_EVENT } from '../api/client'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    authApi
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setReady(true))
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      alive = false
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const u = await authApi.login(username, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
