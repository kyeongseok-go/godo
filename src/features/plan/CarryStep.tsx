import { useMemo } from 'react'
import { addDays } from '../../domain/date'
import type { ID } from '../../domain/types'
import { cancelPlanned, pushTasksToDay, shelveAsSomeday } from './actions'
import { scheduledTasks } from './logic'
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

/** ② 못 끝낸 일 처리 — 내일로 / 언젠가 / 취소를 그 자리에서 정한다 */
export function CarryStep({ pc, nav }: StepProps) {
  const { ctx, today } = pc
  const tomorrow = addDays(today, 1)
  const open = useMemo(() => scheduledTasks(ctx.tasks, today), [ctx.tasks, today])

  const toTomorrow = (ids: readonly ID[]) =>
    pushTasksToDay(ids, tomorrow, '못 끝낸 일 내일로', ids.length > 1 ? `${ids.length}개를 내일로 옮겼어요` : '내일로 옮겼어요')

  return (
    <StepFrame
      title="못 끝낸 일 정리"
      hint="괜찮아요, 오늘 못 한 일은 어디든 보내면 돼요. 한 줄씩 정해 주세요."
      nav={nav}
      nextLabel="한 줄 회고"
    >
      {open.length > 0 ? (
        <>
          <ul className="plan-lines">
            {open.map((task) => (
              <PlanLine
                key={task.id}
                task={task}
                trail={
                  <div className="plan-line__choices" role="group" aria-label={`"${task.title}" 처리`}>
                    <button type="button" className="ritual-btn" onClick={() => toTomorrow([task.id])}>
                      내일로
                    </button>
                    <button type="button" className="ritual-btn" onClick={() => shelveAsSomeday(task.id, today)}>
                      언젠가
                    </button>
                    <button type="button" className="ritual-btn ritual-btn--danger" onClick={() => cancelPlanned(task.id)}>
                      취소
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
          <button
            type="button"
            className="ritual-btn ritual-btn--primary plan-bulk"
            onClick={() => toTomorrow(open.map((t) => t.id))}
          >
            {open.length}개 모두 내일로
          </button>
        </>
      ) : (
        <EmptyNote>못 끝낸 일이 없어요. 깔끔하게 마무리했네요.</EmptyNote>
      )}
    </StepFrame>
  )
}
