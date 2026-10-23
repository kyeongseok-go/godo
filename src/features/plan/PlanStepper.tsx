import { Check } from 'lucide-react'
import './plan.css'

export interface StepInfo {
  id: string
  label: string
}

interface PlanStepperProps {
  steps: readonly StepInfo[]
  current: number
  label: string
  onSelect: (index: number) => void
}

/** 괘선 위에 번호를 얹은 단계 표시. 지난 단계는 먹색, 지금 단계는 주홍 굵은 괘선. */
export function PlanStepper({ steps, current, label, onSelect }: PlanStepperProps) {
  return (
    <nav aria-label={label}>
      <ol className="plan-steps" style={{ ['--steps' as string]: steps.length }}>
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo'
          return (
            <li key={step.id}>
              <button
                type="button"
                className="plan-steps__item"
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
                onClick={() => onSelect(index)}
              >
                <span className="plan-steps__num" aria-hidden="true">
                  {index + 1}
                  {state === 'done' ? <Check size={15} strokeWidth={3} /> : null}
                </span>
                <span className="plan-steps__rule" aria-hidden="true" />
                <span className="plan-steps__label">
                  <span className="sr-only">{`${index + 1}단계${state === 'done' ? ' 지남' : ''}: `}</span>
                  {step.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
