import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import type { Task } from '../../domain/types'
import { setPicked } from './actions'
import { morningCandidates } from './logic'
import { CapacityMeter } from './CapacityMeter'
import { EmptyNote, PickBox } from './PlanControls'
import { PlanLine } from './PlanLine'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'

interface StepProps {
  pc: PlanContext
  nav: StepNav
}

const MAX_LISTED = 20

const isOpenTask = (t: Task): boolean => t.deletedAt === null && (t.status === 'todo' || t.status === 'active')

/**
 * ② 오늘 후보 고르기. 담을 수 있는 일은 단계에 들어올 때 한 번 정해 둔다.
 * 체크하는 순간 그 일이 "오늘에 있는 일"로 옮겨 가 목록이 뛰는 걸 막으려는 것이다.
 */
export function PickStep({ pc, nav }: StepProps) {
  const [initial] = useState(() => {
    const available = morningCandidates(pc.ctx).available
    return { ids: available.slice(0, MAX_LISTED).map((t) => t.id), hidden: Math.max(0, available.length - MAX_LISTED) }
  })
  const byId = useMemo(() => new Map(pc.ctx.tasks.map((t) => [t.id, t])), [pc.ctx.tasks])
  const listed = new Set(initial.ids)
  const candidates = initial.ids.flatMap((id) => {
    const task = byId.get(id)
    return task !== undefined && isOpenTask(task) ? [task] : []
  })
  const alreadyToday = morningCandidates(pc.ctx).scheduled.filter((t) => !listed.has(t.id))

  return (
    <StepFrame
      title="오늘 후보 고르기"
      hint="오늘 할 수 있을 만큼만 담아요. 다 담지 않아도 괜찮아요."
      nav={nav}
      nextLabel="용량 확인"
    >
      <CapacityMeter date={pc.today} />
      <h3 className="plan-sub">
        이미 오늘에 있는 일 <span>{alreadyToday.length}</span>
      </h3>
      {alreadyToday.length > 0 ? (
        <ul className="plan-lines">
          {alreadyToday.map((task) => (
            <PlanLine key={task.id} task={task} />
          ))}
        </ul>
      ) : (
        <EmptyNote>아직 오늘로 잡은 일이 없어요.</EmptyNote>
      )}
      <h3 className="plan-sub">
        지금 할 수 있는 일, 날짜 없음 <span>{candidates.length + initial.hidden}</span>
      </h3>
      {candidates.length > 0 ? (
        <ul className="plan-lines">
          {candidates.map((task) => (
            <PlanLine
              key={task.id}
              task={task}
              lead={
                <PickBox
                  checked={task.startDate === pc.today}
                  label={`"${task.title}" 오늘에 담기`}
                  onChange={(on) => setPicked(task.id, pc.today, on)}
                />
              }
            />
          ))}
        </ul>
      ) : (
        <EmptyNote>날짜가 비어 있는 일이 없어요. 새 할 일은 Q 키로 추가할 수 있어요.</EmptyNote>
      )}
      {initial.hidden > 0 ? (
        <p className="plan-more">
          나머지 {initial.hidden}개는 <Link to={paths.now}>지금 할 수 있는 것</Link>에서 볼 수 있어요.
        </p>
      ) : null}
    </StepFrame>
  )
}
