interface ToggleSwitchProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

/** 켜짐·꺼짐 스위치. 상태는 색만이 아니라 손잡이 위치와 "켜짐/꺼짐" 글자로도 전달한다. */
export function ToggleSwitch({ checked, label, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="prod-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="prod-switch__track" aria-hidden="true">
        <span className="prod-switch__thumb" />
      </span>
      <span className="prod-switch__text" aria-hidden="true">{checked ? '켜짐' : '꺼짐'}</span>
    </button>
  )
}
