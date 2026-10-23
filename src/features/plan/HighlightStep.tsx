import { useMemo } from 'react'
import { useToasts } from '../../ui/toast'
import { saveHighlights } from './actions'
import { MAX_HIGHLIGHTS, sanitizeHighlights, scheduledTasks, toggleHighlight } from './logic'
import { EmptyNote, StarButton } from './PlanControls'
import { PlanLine } from './PlanLine'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'
import './ritual.css'

interface StepProps {
  pc: PlanContext
  nav: StepNav
  onGoPick: () => void
}

/** ④ 오늘의 핵심 2~3개 — 오늘 다른 일이 밀려도 이것만큼은 하자고 정해 두는 자리 */
export function HighlightStep({ pc, nav, onGoPick }: StepProps) {
  const { ctx, today, plan } = pc
  const todays = useMemo(() => scheduledTasks(ctx.tasks, today), [ctx.tasks, today])
  const chosen = useMemo(
    () => sanitizeHighlights(plan.highlightIds, new Set(todays.map((t) => t.id))),
    [plan.highlightIds, todays],
  )

  const toggle = (id: string) => {
    const result = toggleHighlight(chosen, id)
    if (result.rejected) {
      useToasts.getState().push(`핵심은 최대 ${MAX_HIGHLIGHTS}개예요. 하나를 빼고 골라 보세요.`)
      return
    }
    saveHighlights(today, result.ids)
  }

  return (
    <StepFrame
      title="오늘의 핵심 고르기"
      hint="오늘 이것만 해도 충분한 일을 2~3개 골라요. 나머지는 덤이에요."
      nav={nav}
      nextLabel="시간 배치"
    >
      <p className="plan-count" aria-live="polite">
        <strong>{chosen.length}</strong> / {MAX_HIGHLIGHTS}개 선택
      </p>
      {todays.length > 0 ? (
        <ul className="plan-lines">
          {todays.map((task) => {
            const on = chosen.includes(task.id)
            return (
              <PlanLine
                key={task.id}
                task={task}
                lead={
                  <StarButton
                    pressed={on}
                    label={on ? `"${task.title}" 핵심에서 빼기` : `"${task.title}" 오늘의 핵심으로`}
                    onToggle={() => toggle(task.id)}
                  />
                }
              />
            )
          })}
        </ul>
      ) : (
        <>
          <EmptyNote>오늘로 담은 일이 없어요. 먼저 후보를 골라 담아 볼까요?</EmptyNote>
          <button type="button" className="ritual-btn" onClick={onGoPick}>
            후보 고르기로 가기
          </button>
        </>
      )}
    </StepFrame>
  )
}
