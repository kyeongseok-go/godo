import { Check } from 'lucide-react'
import type { Priority } from '../domain/types'
import './checkbox.css'

interface CheckboxProps {
  checked: boolean
  priority?: Priority
  label: string
  onChange: (checked: boolean) => void
  /** 취소된 항목은 빈 원 대신 가로선을 보여준다 */
  canceled?: boolean
}

export function Checkbox({ checked, priority = 4, label, onChange, canceled }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="check"
      data-priority={priority}
      data-checked={checked}
      data-canceled={canceled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <Check size={13} strokeWidth={3} aria-hidden="true" />
    </button>
  )
}
