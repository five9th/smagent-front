// DTOs mirroring the backend API (see smagent/docs/API.md).

export type Platform = 'FACEBOOK' | 'REDDIT' | 'X' | 'LINKEDIN'

export type AuthMethod = 'PAGE_ACCESS_TOKEN' | 'PASSWORD_GRANT' | 'PROFILE_URL'
export type AccountStatus = 'UNVERIFIED' | 'ACTIVE' | 'INVALID'
export type PostStatus = 'DRAFT' | 'PUBLISHED'
export type PublicationStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface UserDto {
  id: number
  username: string
  role: string
}

/** The post's own title+text unit; media fields may land here later. */
export interface PostContent {
  title: string | null
  text: string
}

export interface AccountDto {
  id: number
  platform: Platform
  authMethod: AuthMethod
  /** False for manual login options (PROFILE_URL) — no platform API access. */
  canPublish: boolean
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
