import { Check } from 'lucide-react'
import type { Priority } from '../domain/types'
import { useJustChanged } from '../hooks/flash'
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
  // 방금 눌려서 바뀐 것만 튀어오른다. 목록을 열 때 이미 끝나 있던 일들은 가만히 있어야 한다.
  const pop = useJustChanged(checked)

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
      data-pop={pop || undefined}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <Check size={13} strokeWidth={3} aria-hidden="true" />
    </button>
  )
}
