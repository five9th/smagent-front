import { api } from './client'
import type { AccountDto, Platform, VerifyResult } from './types'

export interface AccountInput {
  platform: Platform
  displayName?: string
  credentials: Record<string, string>
}

export const accountsApi = {
  /** Soft-deleted accounts reappear only with showDeleted=true. */
  list: (showDeleted?: boolean) =>
    api<AccountDto[]>('GET', `/social-accounts${showDeleted ? '?showDeleted=true' : ''}`),

  create: (input: AccountInput) => api<AccountDto>('POST', '/social-accounts', input),

  /** Replace displayName and/or credentials. Updating credentials resets status to UNVERIFIED. */
  update: (
    id: number,
    input: { displayName?: string; credentials?: Record<string, string> },
  ) => api<AccountDto>('PUT', `/social-accounts/${id}`, input),

  remove: (id: number) => api<void>('DELETE', `/social-accounts/${id}`),

  /** Cheap "who am I" platform call; always 200 with ok/message. */
  verify: (id: number) => api<VerifyResult>('POST', `/social-accounts/${id}/verify`),
}
