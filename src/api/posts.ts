import { api } from './client'
import type { PostDto, PostInput, PublicationDto, PublishResult } from './types'

export const postsApi = {
  /** All posts, newest first; omit status to get both DRAFT and PUBLISHED. */
  list: (status?: 'DRAFT' | 'PUBLISHED', showDeleted?: boolean) =>
    api<PostDto[]>('GET', `/posts${buildQuery({ status, showDeleted })}`),

  get: (id: number) => api<PostDto>('GET', `/posts/${id}`),

  create: (input: PostInput) => api<PostDto>('POST', '/posts', input),

  /** DRAFT posts only — the backend rejects edits of published posts. */
  update: (id: number, input: PostInput) => api<PostDto>('PUT', `/posts/${id}`, input),

  /**
   * Soft delete. For PUBLISHED posts the backend demands an explicit
   * `deletePublications` choice (absent → 400, true → 501 until platform-side
   * deletion is implemented), so pass `false` for "local delete only".
   */
  remove: (id: number, deletePublications?: boolean) =>
    api<void>(
      'DELETE',
      `/posts/${id}${deletePublications === undefined ? '' : `?deletePublications=${deletePublications}`}`,
    ),

  publish: (id: number, accountIds: number[]) =>
    api<PublishResult>('POST', `/posts/${id}/publish`, { accountIds }),

  /** Flat attempt log for one post, newest first. Requires postId. */
  publications: (postId: number) =>
    api<PublicationDto[]>('GET', `/publications?postId=${postId}`),
}

function buildQuery(params: Record<string, unknown>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return q ? `?${q}` : ''
}
