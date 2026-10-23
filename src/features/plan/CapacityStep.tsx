import { useMemo } from 'react'
import { formatDuration } from '../../domain/format'
import { addDays } from '../../domain/date'
import { pushTasksToDay } from './actions'
import { offloadCandidates } from './logic'
import { dayLoad } from '../../domain/planning'
import { CapacityMeter } from './CapacityMeter'
import { EmptyNote } from './PlanControls'
import { PlanLine } from './PlanLine'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'
import './ritual.css'

interface StepProps {
  pc: PlanContext
  nav: StepNav
}

/** ③ 용량 확인 — 넘쳤다면 덜 급한 일부터 내일로 밀 후보를 보여 주고, 한 번에 밀 수 있게 한다 */
export function CapacityStep({ pc, nav }: StepProps) {
  const { ctx, today, plan, capacityMin, settings } = pc
  const tomorrow = addDays(today, 1)
  const candidates = useMemo(
    () => offloadCandidates(ctx.tasks, today, capacityMin, settings.defaultDurationMin, plan.highlightIds),
    [ctx.tasks, today, capacityMin, settings.defaultDurationMin, plan.highlightIds],
  )

  const isOver = dayLoad(today, ctx.tasks, capacityMin, settings.defaultDurationMin).level === 'over'

  const push = (ids: readonly string[], message: string) => pushTasksToDay(ids, tomorrow, '내일로 밀기', message)
  const dayText = formatDuration(capacityMin)

  return (
    <StepFrame
      title="용량 확인"
      hint={`하루 용량은 ${dayText}예요. 숫자를 눌러 오늘만 바꿀 수도 있어요.`}
      nav={nav}
      nextLabel="오늘의 핵심 고르기"
    >
      <CapacityMeter date={today} />
      {candidates.length > 0 ? (
        <>
          <h3 className="plan-sub">
            내일로 밀면 가벼워지는 일 <span>{candidates.length}</span>
          </h3>
          <p className="plan-hint">덜 급한 일부터 골랐어요. 오늘의 핵심과 고정한 일은 빼 뒀어요.</p>
          <ul className="plan-lines">
            {candidates.map((task) => (
              <PlanLine
                key={task.id}
                task={task}
                trail={
                  <button
                    type="button"
                    className="ritual-btn"
                    aria-label={`"${task.title}" 내일로`}
                    onClick={() => push([task.id], '내일로 밀었어요')}
                  >
                    내일로
                  </button>
                }
              />
            ))}
          </ul>
          <button
            type="button"
            className="ritual-btn ritual-btn--primary plan-bulk"
            onClick={() => push(candidates.map((t) => t.id), `${candidates.length}개를 내일로 밀었어요`)}
          >
            {candidates.length}개 한 번에 내일로 밀기
          </button>
        </>
      ) : (
        <EmptyNote>
          {isOver
            ? '덜어낼 후보가 없어요. 핵심이나 고정을 풀거나, 오늘 용량을 바꿔 보세요.'
            : '오늘은 여유 있게 담았어요. 이대로 괜찮아요.'}
        </EmptyNote>
      )}
    </StepFrame>
  )
}
