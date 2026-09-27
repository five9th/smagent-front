import { api } from './client'
import type { UserDto } from './types'

export const authApi = {
  login: (username: string, password: string) =>
    api<UserDto>('POST', '/auth/login', { username, password }),

  logout: () => api<void>('POST', '/auth/logout'),

  me: () => api<UserDto>('GET', '/auth/me'),
}
