import { api } from './client'

/** Platforms whose OAuth app credentials can be overridden at runtime. */
export type OAuthProviderKey = 'facebook' | 'linkedin' | 'x'

/** GET /api/admin/settings — which overrides are stored (values never returned). */
export interface AdminSettingsStatus {
  facebook: { clientIdSet: boolean; clientSecretSet: boolean }
  linkedin: { clientIdSet: boolean; clientSecretSet: boolean }
  x: { clientIdSet: boolean; clientSecretSet: boolean }
}

export interface AdminSettingsOverride {
  clientId?: string
  clientSecret?: string
}

export const adminApi = {
  status: () => api<AdminSettingsStatus>('GET', '/admin/settings'),

  /**
   * Replace the whole override set (204): stored overrides are deleted, then
   * only what's in the body is saved — omitted fields clear back to config
   * values. Blank values are rejected (400), send only non-empty strings.
   */
  putSettings: (overrides: Partial<Record<OAuthProviderKey, AdminSettingsOverride>>) =>
    api<void>('PUT', '/admin/settings', overrides),
}
