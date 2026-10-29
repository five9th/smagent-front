import { ApiError } from '../api/client'

export interface DescribedError {
  /** Short human headline ("Server error", "Not found", "Sign-in failed"). */
  title: string
  /** Optional longer explanation — the backend message, cleaned up. */
  detail?: string
}

const STATUS_TITLES: Record<number, string> = {
  400: 'Invalid request',
  401: 'Session expired',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
  501: 'Not implemented',
  502: 'Platform error',
}

/** Collapse whitespace and cap runaway backend messages (SQL dumps etc.). */
function cleanDetail(msg: string): string {
  const s = msg.replace(/\s+/g, ' ').trim()
  return s.length > 280 ? s.slice(0, 279).trimEnd() + '…' : s
}

/** Translate the raw JDBC noise into something a human can act on. */
function friendlyDetail(detail: string): string {
  if (/referential integrity constraint violation/i.test(detail)) {
    return 'The server refused the change — this record is still referenced by other data.'
  }
  return detail
}

export function describeError(error: unknown): DescribedError {
  if (typeof error === 'string') return { title: error }

  if (error instanceof ApiError) {
    const title =
      STATUS_TITLES[error.status] ??
      (error.status >= 500 ? 'Server error' : 'Request failed')
    return {
      title,
      detail: error.message ? friendlyDetail(cleanDetail(error.message)) : undefined,
    }
  }

  // fetch() network failures surface as TypeError
  if (error instanceof TypeError) {
    return {
      title: 'Connection lost',
      detail: 'The server could not be reached — it may be offline or restarting.',
    }
  }
  if (error instanceof Error) {
    return { title: 'Something went wrong', detail: friendlyDetail(cleanDetail(error.message)) }
  }
  return { title: 'Something went wrong' }
}
