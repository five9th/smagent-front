import { useContext } from 'react'
import { ToastContext, type ToastFn } from './toastContext'

export function useToast(): ToastFn {
  return useContext(ToastContext)
}
