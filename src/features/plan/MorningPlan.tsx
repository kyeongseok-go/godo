import { useState } from 'react'
import { CapacityStep } from './CapacityStep'
import { HighlightStep } from './HighlightStep'
import { PickStep } from './PickStep'
import { PlaceStep } from './PlaceStep'
import { PlanStepper } from './PlanStepper'
import type { StepInfo } from './PlanStepper'
import { ReviewStep } from './ReviewStep'
import { usePlanContext } from './usePlanContext'

const STEPS: readonly StepInfo[] = [
  { id: 'review', label: '어제 정리' },
  { id: 'pick', label: '후보 고르기' },
  { id: 'capacity', label: '용량 확인' },
  { id: 'highlight', label: '핵심 고르기' },
  { id: 'place', label: '시간 배치' },
]

const PICK_INDEX = 1

/** 아침 계획(F4): 어제 정리 → 담기 → 용량 확인 → 핵심 고르기 → 자동 배치 */
export function MorningPlan() {
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
      <PlanStepper steps={STEPS} current={step} label="아침 계획 단계" onSelect={goTo} />
      {step === 0 ? <ReviewStep pc={pc} nav={nav} /> : null}
      {step === 1 ? <PickStep pc={pc} nav={nav} /> : null}
      {step === 2 ? <CapacityStep pc={pc} nav={nav} /> : null}
      {step === 3 ? <HighlightStep pc={pc} nav={nav} onGoPick={() => goTo(PICK_INDEX)} /> : null}
      {step === 4 ? <PlaceStep pc={pc} nav={nav} /> : null}
    </div>
  )
}
