import { api } from './client'
import type { PostDto, PostInput, PublicationDto, PublishResult } from './types'

export const postsApi = {
  /** All posts, newest first; omit status to get both DRAFT and PUBLISHED. */
  list: (status?: 'DRAFT' | 'PUBLISHED') =>
    api<PostDto[]>('GET', `/posts${status ? `?status=${status}` : ''}`),

  get: (id: number) => api<PostDto>('GET', `/posts/${id}`),

  create: (input: PostInput) => api<PostDto>('POST', '/posts', input),

  /** DRAFT posts only — the backend rejects edits of published posts. */
  update: (id: number, input: PostInput) => api<PostDto>('PUT', `/posts/${id}`, input),

  /** Local delete only — does not remove the post on the platforms. */
  remove: (id: number) => api<void>('DELETE', `/posts/${id}`),

  publish: (id: number, accountIds: number[]) =>
    api<PublishResult>('POST', `/posts/${id}/publish`, { accountIds }),

  /** Flat attempt log for one post, newest first. Requires postId. */
  publications: (postId: number) =>
    api<PublicationDto[]>('GET', `/publications?postId=${postId}`),
}
