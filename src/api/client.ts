// Thin fetch wrapper: session cookie auth, the backend's global error shape,
// and a global "session expired" event (anything but /auth/* returning 401).

export class ApiError extends Error {
  readonly status: number
  readonly timestamp?: string

  constructor(status: number, message: string, timestamp?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.timestamp = timestamp
  }
}

export const UNAUTHORIZED_EVENT = 'smagent:unauthorized'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  let data: unknown = null
  const raw = await res.text()
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    // A non-auth endpoint rejecting us means the session died; let the app
    // bounce to the login screen. /auth/* 401s are handled by their callers.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    const obj = (data ?? {}) as { message?: string; timestamp?: string }
    throw new ApiError(res.status, obj.message ?? `Request failed (${res.status})`, obj.timestamp)
  }

  return data as T
}
