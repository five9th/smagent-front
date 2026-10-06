import type { AuthMethod, Platform } from '../api/types'

export interface CredentialField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  /** Identifier, not a secret — shown in full in credentialsMasked (nonSecretCredentialFields). */
  nonSecret?: boolean
  hint?: string
}

/** One way to connect a platform (mirrors a backend adapter: platform × authMethod). */
export interface LoginOption {
  authMethod: AuthMethod
  /** False for manual options (PROFILE_URL) — no platform API access. */
  canPublish: boolean
  /** True when a prefilled share/composer URL can be composed for this option. */
  canShare: boolean
  fields: CredentialField[]
}

export interface PlatformMeta {
  label: string
  /** Soft client-side hint for the preview counter; the backend doesn't enforce limits. */
  maxLength: number
  requiresTitle: boolean
  loginOptions: LoginOption[]
}

/** Friendly names for the login-option selects and account cards. */
export const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  PAGE_ACCESS_TOKEN: 'Access token',
  PASSWORD_GRANT: 'Username & password',
  PROFILE_URL: 'Profile link — post by hand',
}

const PROFILE_URL_FIELD: CredentialField = {
  key: 'profileUrl',
  label: 'Link to your page or profile',
  nonSecret: true,
  placeholder: 'https://facebook.com/your-page',
  hint: 'Manual option: SMAgent can’t post here automatically — “Open to post by hand” opens the platform’s composer with the post prefilled.',
}

function profileUrlOption(fields: CredentialField[] = [PROFILE_URL_FIELD]): LoginOption {
  return { authMethod: 'PROFILE_URL', canPublish: false, canShare: true, fields }
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  FACEBOOK: {
    label: 'Facebook',
    maxLength: 5000,
    requiresTitle: false,
    loginOptions: [
      {
        authMethod: 'PAGE_ACCESS_TOKEN',
        canPublish: true,
        canShare: false,
        fields: [
          { key: 'pageId', label: 'Page ID', placeholder: '123456789012345', nonSecret: true },
          {
            key: 'pageAccessToken',
            label: 'Page access token',
            placeholder: 'EAAB…',
            secret: true,
            hint: 'Long-lived Page token (see the project README for the walkthrough).',
          },
        ],
      },
      profileUrlOption(),
    ],
  },
  REDDIT: {
    label: 'Reddit',
    maxLength: 40000,
    requiresTitle: true,
    loginOptions: [
      {
        authMethod: 'PASSWORD_GRANT',
        canPublish: true,
        canShare: false,
        fields: [
          { key: 'clientId', label: 'Client ID', placeholder: 'client-id', nonSecret: true },
          { key: 'clientSecret', label: 'Client secret', placeholder: 'client-secret', secret: true },
          { key: 'username', label: 'Username', placeholder: 'reddit-user', nonSecret: true },
          { key: 'password', label: 'Password', placeholder: '••••••••', secret: true },
          { key: 'subreddit', label: 'Subreddit', placeholder: 'test (without r/)', nonSecret: true },
        ],
      },
      profileUrlOption([
        PROFILE_URL_FIELD,
        { key: 'subreddit', label: 'Subreddit', placeholder: 'test (without r/)', nonSecret: true },
      ]),
    ],
  },
  X: {
    label: 'X',
    maxLength: 280,
    requiresTitle: false,
    loginOptions: [profileUrlOption()],
  },
  LINKEDIN: {
    label: 'LinkedIn',
    maxLength: 3000,
    requiresTitle: false,
    loginOptions: [profileUrlOption()],
  },
}

export const PLATFORM_LIST = Object.keys(PLATFORMS) as Platform[]

/** Platforms with an API login option — override tabs and previews only make sense for these. */
export const PUBLISHABLE_PLATFORMS = PLATFORM_LIST.filter((p) =>
  PLATFORMS[p].loginOptions.some((o) => o.canPublish),
)

export function loginOptionFor(platform: Platform, authMethod: AuthMethod): LoginOption | undefined {
  return PLATFORMS[platform].loginOptions.find((o) => o.authMethod === authMethod)
}

/** Default login option for a platform: the first API option, else the first one. */
export function defaultLoginOption(platform: Platform): LoginOption {
  return PLATFORMS[platform].loginOptions.find((o) => o.canPublish) ?? PLATFORMS[platform].loginOptions[0]
}
