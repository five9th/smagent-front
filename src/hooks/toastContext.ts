import { createContext } from 'react'

export type ToastTone = 'ok' | 'error'

export type ToastFn = (msg: string, tone?: ToastTone) => void

export const ToastContext = createContext<ToastFn>(() => {})
