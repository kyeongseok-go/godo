import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  tone: 'info' | 'error'
  /** 같은 말이 연달아 올라온 횟수. 1이면 숫자를 보여 주지 않는다 */
  count: number
}

interface ToastState {
  toasts: readonly Toast[]
  push: (message: string, opts?: { actionLabel?: string; onAction?: () => void; tone?: Toast['tone']; ttlMs?: number }) => void
  dismiss: (id: number) => void
}

let nextId = 1
const MAX_TOASTS = 3

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, opts) => {
    const tone = opts?.tone ?? 'info'
    const ttl = opts?.ttlMs ?? (opts?.actionLabel ? 6000 : 3500)
    const last = get().toasts.at(-1)
    // 여러 개를 한 번에 추가할 때 "추가했어요"가 세 줄로 쌓이지 않게, 같은 말이면 숫자만 올린다.
    if (last && last.message === message && last.tone === tone && !opts?.actionLabel && !last.actionLabel) {
      const merged: Toast = { ...last, count: last.count + 1 }
      set((s) => ({ toasts: [...s.toasts.slice(0, -1), merged] }))
      setTimeout(() => get().dismiss(merged.id), ttl)
      return
    }
    const id = nextId++
    const toast: Toast = { id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction, tone, count: 1 }
    // 최대 3개까지만 쌓는다. 오래된 것부터 밀어낸다.
    set((s) => ({ toasts: [...s.toasts, toast].slice(-MAX_TOASTS) }))
    setTimeout(() => get().dismiss(id), ttl)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
