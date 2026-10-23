import type { ReactNode } from 'react'
import { Dialog } from '../../ui/Dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** 되돌릴 수 없는 일이면 확인 버튼을 위험색으로 보여 준다 */
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 되돌리기 어려운 작업 앞에서 한 번 더 묻는 대화상자. 취소가 기본 포커스다. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} label={title} width="min(28rem, calc(100vw - 2rem))">
      <div className="st-confirm">
        <h2 className="st-confirm__title">{title}</h2>
        <div className="st-confirm__body">{children}</div>
        <footer className="st-confirm__foot">
          <button type="button" className="st-btn" autoFocus onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="button" className={danger ? 'st-btn st-btn--danger' : 'st-btn st-btn--primary'} onClick={onConfirm} disabled={busy}>
            {busy ? '처리 중…' : confirmLabel}
          </button>
        </footer>
      </div>
    </Dialog>
  )
}
