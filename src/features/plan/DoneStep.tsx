import { useMemo } from 'react'
import { formatDuration } from '../../domain/format'
import { eveningSummary, highlightProgress } from './logic'
import { EmptyNote } from './PlanControls'
import { PlanLine } from './PlanLine'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'

interface StepProps {
  pc: PlanContext
  nav: StepNav
}

/** ① 오늘 한 일 돌아보기 — 끝낸 일과 예상 대 실제 시간 */
export function DoneStep({ pc, nav }: StepProps) {
  const { ctx, today, plan, settings } = pc
  const summary = useMemo(
    () => eveningSummary(ctx.tasks, today, settings.dayStartHour),
    [ctx.tasks, today, settings.dayStartHour],
  )
  const highlights = highlightProgress(plan.highlightIds, ctx.tasks)
  const count = summary.done.length

  return (
    <StepFrame
      title="오늘 한 일 돌아보기"
      hint="오늘 끝낸 일을 가볍게 훑어 봐요. 많든 적든 오늘의 몫이에요."
      nav={nav}
      nextLabel="못 끝낸 일 정리"
    >
      <dl className="plan-figures">
        <div>
          <dt>끝낸 일</dt>
          <dd>
            {count}
            <span>개</span>
          </dd>
        </div>
        <div>
          <dt>예상 시간</dt>
          <dd>{summary.estimateMin > 0 ? formatDuration(summary.estimateMin) : '—'}</dd>
        </div>
        <div>
          <dt>실제 시간</dt>
          <dd>{summary.actualMin > 0 ? formatDuration(summary.actualMin) : '—'}</dd>
        </div>
      </dl>
      {highlights.total > 0 ? (
        <p className="plan-hint">
          오늘의 핵심 {highlights.total}개 중 {highlights.done}개를 끝냈어요.
        </p>
      ) : null}
      {count > 0 ? (
        <ul className="plan-lines">
          {summary.done.map((task) => {
            const actual = task.actualMin[today] ?? 0
            return <PlanLine key={task.id} task={task} note={actual > 0 ? `실제 ${formatDuration(actual)}` : '시간 기록 없음'} />
          })}
        </ul>
      ) : (
        <EmptyNote>오늘 끝낸 일이 아직 없어요. 괜찮아요, 쉬는 날도 있어요.</EmptyNote>
      )}
      {count > 0 && summary.untrackedCount > 0 ? (
        <p className="plan-hint">시간을 기록하지 않은 일 {summary.untrackedCount}개는 실제 시간 합계에 빠져 있어요.</p>
      ) : null}
    </StepFrame>
  )
}
