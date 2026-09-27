import type { Platform } from '../api/types'

export interface CredentialField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  hint?: string
}

export interface PlatformMeta {
  label: string
  /** Soft client-side hint for the preview counter; the backend doesn't enforce limits. */
  maxLength: number
  requiresTitle: boolean
  credentialFields: CredentialField[]
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  FACEBOOK: {
    label: 'Facebook',
    maxLength: 5000,
    requiresTitle: false,
    credentialFields: [
      { key: 'pageId', label: 'Page ID', placeholder: '123456789012345' },
      {
        key: 'pageAccessToken',
        label: 'Page access token',
        placeholder: 'EAAB…',
        secret: true,
        hint: 'Long-lived Page token (see backend README for the walkthrough).',
      },
    ],
  },
  REDDIT: {
    label: 'Reddit',
    maxLength: 40000,
    requiresTitle: true,
    credentialFields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'client-id' },
      { key: 'clientSecret', label: 'Client secret', placeholder: 'client-secret', secret: true },
      { key: 'username', label: 'Username', placeholder: 'reddit-user' },
      { key: 'password', label: 'Password', placeholder: '••••••••', secret: true },
      { key: 'subreddit', label: 'Subreddit', placeholder: 'test (without r/)' },
    ],
  },
}

export const PLATFORM_LIST = Object.keys(PLATFORMS) as Platform[]
