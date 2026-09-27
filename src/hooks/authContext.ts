import { createContext } from 'react'
import type { UserDto } from '../api/types'

export interface AuthContextValue {
  user: UserDto | null
  /** True once the initial /auth/me check has settled. */
  ready: boolean
  login: (username: string, password: string) => Promise<UserDto>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
