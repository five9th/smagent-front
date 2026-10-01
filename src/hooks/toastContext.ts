import { createContext } from 'react'
import type { DescribedError } from '../lib/errors'

export type ToastTone = 'ok' | 'error'

/** A toast body: plain text, or a structured {title, detail} pair. */
export type ToastInput = string | DescribedError

export type ToastFn = (msg: ToastInput, tone?: ToastTone) => void

export const ToastContext = createContext<ToastFn>(() => {})
