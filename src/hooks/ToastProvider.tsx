import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ToastContext, type ToastInput, type ToastTone } from './toastContext'
import type { DescribedError } from '../lib/errors'

interface Toast {
  id: number
  msg: ToastInput
  tone: ToastTone
}

function ToastBody({ msg }: { msg: ToastInput }) {
  if (typeof msg === 'string') return <>{msg}</>
  const d = msg as DescribedError
  return (
    <>
      <b className="toast-title">{d.title}</b>
      {d.detail && <span className="toast-detail">{d.detail}</span>}
    </>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((msg: ToastInput, tone: ToastTone = 'ok') => {
    const id = ++seq.current
    setToasts((ts) => [...ts, { id, msg, tone }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), msgTtl(msg))
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
            <ToastBody msg={t.msg} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Detailed toasts stay up a little longer — they take longer to read. */
function msgTtl(msg: ToastInput): number {
  return typeof msg === 'string' ? 3400 : 5200
}
