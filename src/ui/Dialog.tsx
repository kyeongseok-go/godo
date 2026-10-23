import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './dialog.css'

interface DialogProps {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  /** 'top'은 명령 팔레트·빠른 추가처럼 화면 위쪽에 뜨는 형태 */
  placement?: 'center' | 'top'
  width?: string
}

/** 네이티브 <dialog>를 감싼다. 포커스 가둠, Esc 닫기, 배경 처리를 브라우저가 해준다. */
export function Dialog({ open, onClose, label, children, placement = 'center', width }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // 코드로 close()를 부르면 'close' 이벤트가 한 박자 뒤에 또 온다. 그 사이에 새로 열린 대화상자를 닫지 않도록 구분한다.
  const closedByCode = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // 자식의 focus() 호출은 대화상자가 열리기 전에 실행되어 무시될 수 있다. 열린 뒤에 한 번 더 맞춘다.
      const target = el.querySelector<HTMLElement>('[data-autofocus]')
      if (target) target.focus()
    }
    if (!open && el.open) {
      closedByCode.current = true
      el.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${placement}`}
      aria-label={label}
      style={width ? { width } : undefined}
      onClose={() => {
        if (closedByCode.current) {
          closedByCode.current = false
          return
        }
        onClose()
      }}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open ? children : null}
    </dialog>
  )
}
