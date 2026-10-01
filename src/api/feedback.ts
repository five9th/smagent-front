import { api } from './client'

export interface FeedbackDto {
  id: number
  text: string
  checked: boolean
  createdAt: string
}

export const feedbackApi = {
  /** Demo checklist, newest first. */
  list: () => api<FeedbackDto[]>('GET', '/feedback'),

  create: (text: string) => api<FeedbackDto>('POST', '/feedback', { text }),

  /** Any of text / checked. */
  update: (id: number, patch: { text?: string; checked?: boolean }) =>
    api<FeedbackDto>('PATCH', `/feedback/${id}`, patch),

  /** Hard delete — demo items have no history. */
  remove: (id: number) => api<void>('DELETE', `/feedback/${id}`),
}
