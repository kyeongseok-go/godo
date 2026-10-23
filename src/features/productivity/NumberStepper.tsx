import { Minus, Plus } from 'lucide-react'
import { stepGoal } from './goalModel'
import type { GoalRange } from './goalModel'
import './stepper.css'

interface NumberStepperProps {
  value: number
  label: string
  unit: string
  range: GoalRange
  onChange: (value: number) => void
}

/** 숫자 스테퍼. 입력창 대신 ± 버튼만 두어 범위를 벗어난 값이 저장되지 않게 한다. */
export function NumberStepper({ value, label, unit, range, onChange }: NumberStepperProps) {
  const set = (delta: number) => onChange(stepGoal(value, delta, range))
  return (
    <div className="prod-stepper" role="group" aria-label={label}>
      <button type="button" className="prod-stepper__btn" aria-label={`${label} 줄이기`} disabled={value <= range.min} onClick={() => set(-1)}>
        <Minus size={15} aria-hidden="true" />
      </button>
      <output className="prod-stepper__value" aria-live="polite">
        <span className="prod-stepper__text">
          {value}
          <span className="prod-stepper__unit">{unit}</span>
        </span>
      </output>
      <button type="button" className="prod-stepper__btn" aria-label={`${label} 늘리기`} disabled={value >= range.max} onClick={() => set(1)}>
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  )
}
