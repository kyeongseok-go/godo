import { useState } from 'react'
import { CarryStep } from './CarryStep'
import { DoneStep } from './DoneStep'
import { PlanStepper } from './PlanStepper'
import type { StepInfo } from './PlanStepper'
import { ReflectStep } from './ReflectStep'
import { usePlanContext } from './usePlanContext'

const STEPS: readonly StepInfo[] = [
  { id: 'done', label: '한 일 돌아보기' },
  { id: 'carry', label: '못 끝낸 일' },
  { id: 'reflect', label: '한 줄 회고' },
]

/** 저녁 회고(F4): 한 일 돌아보기 → 못 끝낸 일 처리 → 한 줄 회고 */
export function EveningPlan() {
  const pc = usePlanContext()
  const [step, setStep] = useState(0)
  const [moved, setMoved] = useState(false)

  const goTo = (index: number) => {
    setStep(Math.min(Math.max(index, 0), STEPS.length - 1))
    setMoved(true)
  }
  const nav = {
    onPrev: step > 0 ? () => goTo(step - 1) : undefined,
    onNext: step < STEPS.length - 1 ? () => goTo(step + 1) : undefined,
    focusOnMount: moved,
  }

  return (
    <div className="plan-flow">
      <PlanStepper steps={STEPS} current={step} label="저녁 회고 단계" onSelect={goTo} />
      {step === 0 ? <DoneStep pc={pc} nav={nav} /> : null}
      {step === 1 ? <CarryStep pc={pc} nav={nav} /> : null}
      {step === 2 ? <ReflectStep pc={pc} nav={nav} /> : null}
    </div>
  )
}
