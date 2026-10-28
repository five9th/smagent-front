import { api } from './client'

/** Platforms whose OAuth app credentials can be overridden at runtime. */
export type OAuthProviderKey = 'facebook' | 'linkedin' | 'x'

/** GET /api/admin/settings — which overrides are stored (values never returned). */
export interface AdminSettingsStatus {
  facebook: { clientIdOverridden: boolean; clientSecretOverridden: boolean }
  linkedin: { clientIdOverridden: boolean; clientSecretOverridden: boolean }
  x: { clientIdOverridden: boolean; clientSecretOverridden: boolean }
}

/** Per-field override patch: a non-empty string sets/replaces, "" clears. */
export interface AdminSettingsOverride {
  clientId?: string
  clientSecret?: string
}

export const adminApi = {
  status: () => api<AdminSettingsStatus>('GET', '/admin/settings'),

  /**
   * Patch the override set field-by-field (204): a non-empty string sets or
   * replaces that field's override, an explicit "" clears it back to the
   * config value, and an omitted field is left untouched.
   */
  putSettings: (overrides: Partial<Record<OAuthProviderKey, AdminSettingsOverride>>) =>
    api<void>('PUT', '/admin/settings', overrides),
}
