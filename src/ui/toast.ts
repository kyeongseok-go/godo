import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  tone: 'info' | 'error'
}

interface ToastState {
  toasts: readonly Toast[]
  push: (message: string, opts?: { actionLabel?: string; onAction?: () => void; tone?: Toast['tone']; ttlMs?: number }) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, opts) => {
    const id = nextId++
    const toast: Toast = { id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction, tone: opts?.tone ?? 'info' }
    // 최대 3개까지만 쌓는다. 오래된 것부터 밀어낸다.
    set((s) => ({ toasts: [...s.toasts, toast].slice(-3) }))
    const ttl = opts?.ttlMs ?? (opts?.actionLabel ? 6000 : 3500)
    setTimeout(() => get().dismiss(id), ttl)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
