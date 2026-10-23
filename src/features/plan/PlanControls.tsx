import { Check, Star } from 'lucide-react'
import type { ReactNode } from 'react'

interface PickBoxProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

/** "오늘에 담기" 체크. 완료용 동그라미와 헷갈리지 않게 네모로 그린다. */
export function PickBox({ checked, label, onChange }: PickBoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      className="plan-pick"
      aria-checked={checked}
      aria-label={label}
      data-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <Check size={15} strokeWidth={3} aria-hidden="true" />
    </button>
  )
}

interface StarButtonProps {
  pressed: boolean
  label: string
  onToggle: () => void
}

export function StarButton({ pressed, label, onToggle }: StarButtonProps) {
  return (
    <button type="button" className="plan-star" aria-pressed={pressed} aria-label={label} onClick={onToggle}>
      <Star size={20} aria-hidden="true" fill={pressed ? 'currentColor' : 'none'} />
    </button>
  )
}

interface EmptyNoteProps {
  children: ReactNode
}

/** 비어 있을 때 다음 행동을 알려주는 한 줄 */
export function EmptyNote({ children }: EmptyNoteProps) {
  return <p className="plan-empty">{children}</p>
}
