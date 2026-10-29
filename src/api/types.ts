// DTOs mirroring the backend API (see smagent/docs/API.md).

export type Platform = 'FACEBOOK' | 'REDDIT' | 'X' | 'LINKEDIN'

export type AuthMethod =
  | 'PAGE_ACCESS_TOKEN'
  | 'PASSWORD_GRANT'
  | 'ACCESS_TOKEN'
  | 'ORGANIZATION_ACCESS_TOKEN'
  | 'PROFILE_URL'
export type AccountStatus = 'UNVERIFIED' | 'ACTIVE' | 'INVALID'
export type PostStatus = 'DRAFT' | 'PUBLISHED'
export type PublicationStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface UserDto {
  id: number
  username: string
  role: string
}

/** The post's own content unit; the optional link feeds manual share composers. */
export interface PostContent {
  title: string | null
  text: string
  link: string | null
}

export interface AccountDto {
  id: number
  platform: Platform
  authMethod: AuthMethod
  /** False for manual login options (PROFILE_URL) — no platform API access. */
  canPublish: boolean
  /** True when the login option can compose a prefilled share/composer URL. */
  canShare: boolean
  displayName: string | null
  status: AccountStatus
  credentialsMasked: Record<string, string>
  createdAt: string
  /** Non-null once soft-deleted (only visible via ?showDeleted=true). */
  deletedAt: string | null
}

export interface PublicationDto {
  id: number
  postId: number
  accountId: number
  platform: Platform
  accountName: string
  status: PublicationStatus
  /** True for rows recorded via publish-manual (posted by hand), not an adapter attempt. */
  publishedManually: boolean
  externalUrl: string | null
  errorMessage: string | null
  publishedAt: string | null
  createdAt: string
}

export interface PostDto {
  id: number
  content: PostContent
  status: PostStatus
  /**
   * Full replacement content per platform; at publish time each field falls
   * back individually — override.title ?? content.title, override.text ?? content.text.
   */
  overrides: Partial<Record<Platform, PostContent>>
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  /** Populated on single-post GET and PUT; empty on list responses. */
  publications: PublicationDto[]
}

export interface PublishTargetResult {
  accountId: number
  platform: Platform
  accountName: string
  status: PublicationStatus
  publishedManually: boolean
  externalUrl: string | null
  errorMessage: string | null
}

export interface PublishResult {
  postId: number
  postStatus: PostStatus
  results: PublishTargetResult[]
}

export interface VerifyResult {
  account: AccountDto
  ok: boolean
  message: string
}

export interface PostInput {
  content: PostContent
  overrides: Partial<Record<Platform, PostContent>>
}

/* --- AI providers & generation --- */

export type AiProviderType = 'ANTHROPIC' | 'OPENAI_COMPATIBLE'
export type GenerateEffort = 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH' | 'MAX'
/** GENERIC plus the publishable platforms — one generate call's variant set. */
export type GeneratePlatform = 'GENERIC' | Platform

export interface AiProviderDto {
  id: number
  name: string
  type: AiProviderType
  /** Custom API root (origin only); null = the official API. */
  baseUrl: string | null
  /** `••••` + last 4 — the stored key is never returned. */
  apiKeyMasked: string
  /** Model for generation requests that don't name one; required (null only on pre-requirement rows). */
  defaultModel: string | null
  createdAt: string
}

export interface AiProviderVerifyResult {
  ok: boolean
  message: string
}

/** One drafted entry; a title only ever appears on GENERIC (optional) and REDDIT. */
export interface GeneratedTextDto {
  title: string | null
  text: string
}

export interface TokenUsageDto {
  inputTokens: number
  outputTokens: number
}

export interface GenerateResult {
  /** GENERIC entry; null when it wasn't requested. */
  content: GeneratedTextDto | null
  overrides: Partial<Record<Platform, GeneratedTextDto>>
  provider: string
  model: string
  usage: TokenUsageDto
  /**
   * One short model feedback sentence — present only when something genuinely
   * needs the user's attention (a contradiction, an unsatisfiable constraint);
   * never describes the generated text.
   */
  note?: string | null
}

/** Effective per-platform style rules plus the built-ins (for reset UIs). */
export interface GenerationSettingsDto {
  platformRules: Record<GeneratePlatform, string>
  defaults: Record<GeneratePlatform, string>
}
