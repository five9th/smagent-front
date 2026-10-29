import { api } from './client'
import type { AccountDto, AuthMethod, Platform, VerifyResult } from './types'

/**
 * Fired after any account mutation (verify/add/edit/remove) so far-away
 * listeners — the topbar health dots in the app shell — refetch their copy.
 */
export const ACCOUNTS_CHANGED_EVENT = 'smagent:accounts-changed'

export function notifyAccountsChanged() {
  window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT))
}

export interface AccountInput {
  platform: Platform
  authMethod: AuthMethod
  displayName?: string
  credentials: Record<string, string>
}

export const accountsApi = {
  /** Soft-deleted accounts reappear only with showDeleted=true. */
  list: (showDeleted?: boolean) =>
    api<AccountDto[]>('GET', `/social-accounts${showDeleted ? '?showDeleted=true' : ''}`),

  create: (input: AccountInput) => api<AccountDto>('POST', '/social-accounts', input),

  /**
   * Replace displayName and/or credentials; authMethod may be switched only
   * together with new credentials (backend rejects a lone switch with 400).
   * mergeCredentials=true partially updates the credential blob instead
   * (authMethod must then match the account's current one).
   */
  update: (
    id: number,
    input: { displayName?: string; credentials?: Record<string, string>; authMethod?: AuthMethod },
    mergeCredentials?: boolean,
  ) =>
    api<AccountDto>(
      'PUT',
      `/social-accounts/${id}${mergeCredentials ? '?mergeCredentials=true' : ''}`,
      input,
    ),

  remove: (id: number) => api<void>('DELETE', `/social-accounts/${id}`),

  /** Cheap "who am I" platform call; always 200 with ok/message. */
  verify: (id: number) => api<VerifyResult>('POST', `/social-accounts/${id}/verify`),
}

/**
 * Top-level navigation URL that starts the 3-legged OAuth flow for an account
 * (GET /api/oauth/<provider>/authorize/{id}). Must be a real navigation, not a
 * fetch — the session cookie and LinkedIn/X redirects ride the browser.
 */
export function oauthAuthorizePath(provider: 'linkedin' | 'x' | 'facebook', accountId: number): string {
  return `${import.meta.env.BASE_URL}api/oauth/${provider}/authorize/${accountId}`
}
