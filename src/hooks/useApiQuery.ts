import { useEffect, useRef, useState } from 'react'

interface QueryState<T> {
  data?: T
  /** Raw error (ApiError, TypeError, …) — describe by calling describeError(). */
  error?: unknown
  loading: boolean
}

/**
 * Minimal data-fetching hook: runs `fetcher` whenever `deps` change (or on
 * refetch), guards against stale responses, and never re-runs because the
 * inline fetcher identity changed.
 */
export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<QueryState<T>>({ loading: true })
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let alive = true
    // The fetch runs in a microtask so the in-flight state transition goes
    // through the same async path as the result (and stays lint-clean).
    Promise.resolve()
      .then(() => {
        if (alive) setState((s) => ({ ...s, loading: true, error: undefined }))
        return fetcherRef.current()
      })
      .then((data) => {
        if (alive) setState({ data, loading: false })
      })
      .catch((e: unknown) => {
        if (alive) setState({ error: e, loading: false })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return {
    ...state,
    refetch: () => setTick((t) => t + 1),
  }
}
