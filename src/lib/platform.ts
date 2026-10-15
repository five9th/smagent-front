import type { AuthMethod, Platform } from '../api/types'

export interface CredentialField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  /** Identifier, not a secret — shown in full in credentialsMasked (nonSecretCredentialFields). */
  nonSecret?: boolean
  /** May be left blank (stored as "" backend-side); everything else is required. */
  optional?: boolean
  hint?: string
}

/** One way to connect a platform (mirrors a backend adapter: platform × authMethod). */
export interface LoginOption {
  authMethod: AuthMethod
  /** False for manual options (PROFILE_URL) — no platform API access. */
  canPublish: boolean
  /** True when a prefilled share/composer URL can be composed for this option. */
  canShare: boolean
  /**
   * 3-legged OAuth flow for the token field: provider slug when available
   * ('linkedin' | 'x'), 'planned' when the backend hasn't shipped it (button
   * renders disabled). Absent for non-token options.
   */
  oauth?: 'linkedin' | 'x' | 'planned'
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
  ACCESS_TOKEN: 'Access token',
  ORGANIZATION_ACCESS_TOKEN: 'Company page token',
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
        oauth: 'planned',
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
    loginOptions: [
      {
        authMethod: 'ACCESS_TOKEN',
        canPublish: true,
        canShare: false,
        oauth: 'x',
        fields: [
          {
            key: 'accessToken',
            label: 'Access token',
            placeholder: 'paste a token, or use the OAuth button below',
            secret: true,
          },
          {
            key: 'refreshToken',
            label: 'Refresh token',
            placeholder: 'filled by the OAuth flow',
            secret: true,
            optional: true,
            hint: 'Optional — lets SMAgent refresh the ~2h access token automatically. With a manually pasted token, leave it out.',
          },
        ],
      },
      profileUrlOption(),
    ],
  },
  LINKEDIN: {
    label: 'LinkedIn',
    maxLength: 3000,
    requiresTitle: false,
    loginOptions: [
      {
        authMethod: 'ACCESS_TOKEN',
        canPublish: true,
        canShare: false,
        oauth: 'linkedin',
        fields: [
          {
            key: 'accessToken',
            label: 'Access token',
            placeholder: 'paste a token, or use the OAuth button below',
            secret: true,
          },
          {
            key: 'userId',
            label: 'User ID',
            placeholder: 'optional — pins the post author',
            nonSecret: true,
            optional: true,
            hint: 'Optional — the member id (a full urn:li:person:… pastes too). Pins the post author and skips the member lookup.',
          },
        ],
      },
      {
        authMethod: 'ORGANIZATION_ACCESS_TOKEN',
        canPublish: true,
        canShare: false,
        oauth: 'linkedin',
        fields: [
          {
            key: 'organizationId',
            label: 'Organization ID',
            placeholder: 'numeric page id (urn:li:organization:… pastes too)',
            nonSecret: true,
          },
          {
            key: 'accessToken',
            label: 'Access token',
            placeholder: 'paste a token, or use the OAuth button below',
            secret: true,
          },
        ],
      },
      profileUrlOption(),
    ],
  },
}

export const PLATFORM_LIST = Object.keys(PLATFORMS) as Platform[]

export function loginOptionFor(platform: Platform, authMethod: AuthMethod): LoginOption | undefined {
  return PLATFORMS[platform].loginOptions.find((o) => o.authMethod === authMethod)
}

/** Default login option for a platform: the first API option, else the first one. */
export function defaultLoginOption(platform: Platform): LoginOption {
  return PLATFORMS[platform].loginOptions.find((o) => o.canPublish) ?? PLATFORMS[platform].loginOptions[0]
}
