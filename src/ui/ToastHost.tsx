import { X } from 'lucide-react'
import { useApp } from '../store/app'
import { useToasts } from './toast'
import './toast.css'

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  const persistError = useApp((s) => s.persistError)
  const dismissError = useApp((s) => s.dismissError)

  return (
    <div className="toast-host" role="region" aria-label="알림" aria-live="polite">
      {persistError ? (
        <div className="toast" data-tone="error" role="alert">
          <span>{persistError}</span>
          <button type="button" className="toast__close" aria-label="닫기" onClick={dismissError}>
            <X size={14} />
          </button>
        </div>
      ) : null}
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone}>
          <span>
            {t.message}
            {t.count > 1 ? <b className="toast__count">{t.count}</b> : null}
          </span>
          {t.actionLabel ? (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                t.onAction?.()
                dismiss(t.id)
              }}
            >
              {t.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
