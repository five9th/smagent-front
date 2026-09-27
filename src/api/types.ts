// DTOs mirroring the backend API (see smagent/docs/API.md).

export type Platform = 'FACEBOOK' | 'REDDIT'
export type AccountStatus = 'UNVERIFIED' | 'ACTIVE' | 'INVALID'
export type PostStatus = 'DRAFT' | 'PUBLISHED'
export type PublicationStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface UserDto {
  id: number
  username: string
  role: string
}

export interface AccountDto {
  id: number
  platform: Platform
  displayName: string | null
  status: AccountStatus
  credentialsMasked: Record<string, string>
  createdAt: string
}

export interface PublicationDto {
  id: number
  postId: number
  accountId: number
  platform: Platform
  accountName: string
  status: PublicationStatus
  externalUrl: string | null
  errorMessage: string | null
  publishedAt: string | null
  createdAt: string
}

export interface PostDto {
  id: number
  title: string | null
  text: string
  status: PostStatus
  overrides: Partial<Record<Platform, string>>
  createdAt: string
  updatedAt: string
  /** Populated on single-post GET and PUT; empty on list responses. */
  publications: PublicationDto[]
}

export interface PublishTargetResult {
  accountId: number
  platform: Platform
  accountName: string
  status: PublicationStatus
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
  title: string | null
  text: string
  overrides: Partial<Record<Platform, string>>
}
