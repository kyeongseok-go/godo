import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import './popover.css'

interface PopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  label: string
  align?: 'start' | 'end'
}

const GAP = 6
const EDGE = 8

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * 팝오버 안으로 포커스를 옮긴다: `[data-autofocus]` → 첫 초점 가능 요소 → 패널 자체.
 * 패널이 보이게 된 뒤에 불러야 한다. `visibility:hidden` 상태에서는 브라우저가 focus() 를 조용히 무시한다.
 */
export function focusInsidePanel(panel: HTMLElement | null): HTMLElement | null {
  if (!panel) return null
  const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel
  target.focus()
  return target
}

/** 앵커 요소 아래(공간이 없으면 위)에 뜨는 팝오버. 바깥 클릭·Esc로 닫히고, 화면 밖으로 나가지 않게 보정한다. */
export function Popover({ open, anchorRef, onClose, children, label, align = 'start' }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // 한 번 열릴 때 포커스는 한 번만 옮긴다. 안에서 다른 칸으로 옮겨 간 포커스를 다시 끌어오지 않도록.
  const focusMoved = useRef(false)

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const a = anchor.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    const below = a.bottom + GAP
    const fitsBelow = below + p.height <= window.innerHeight - EDGE
    const top = fitsBelow ? below : Math.max(EDGE, a.top - GAP - p.height)
    const rawLeft = align === 'end' ? a.right - p.width : a.left
    const left = Math.min(Math.max(EDGE, rawLeft), window.innerWidth - p.width - EDGE)
    setPos({ top, left })
  }, [open, anchorRef, align, children])

  // 위치 계산이 끝나 패널이 보이게 된 뒤에 포커스를 옮긴다(그 전에는 focus() 가 무시된다).
  useEffect(() => {
    if (!open || !pos || focusMoved.current) return
    focusMoved.current = true
    focusInsidePanel(panelRef.current)
  }, [open, pos])

  useEffect(() => {
    if (!open) {
      setPos(null)
      focusMoved.current = false
      return
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 모달 <dialog> 안에서 열렸다면 Esc가 대화상자까지 닫지 않도록 기본 동작(cancel)도 막는다.
        e.preventDefault()
        e.stopPropagation()
        onClose()
        anchorRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, anchorRef, onClose])

  if (!open) return null
  // 모달 <dialog>는 브라우저 최상위 레이어라서 body에 붙인 팝오버는 그 뒤에 깔려 눌리지 않는다.
  // 앵커가 대화상자 안에 있으면 그 대화상자 안으로 포털한다.
  const host = anchorRef.current?.closest('dialog') ?? document.body
  return createPortal(
    <div
      ref={panelRef}
      className="popover"
      role="dialog"
      aria-label={label}
      // 안에 초점 가능한 요소가 없을 때 패널이 포커스를 받아 Esc·방향키를 처리할 수 있게 한다.
      tabIndex={-1}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    host,
  )
}
