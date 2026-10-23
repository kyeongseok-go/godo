import { useMemo, useState } from 'react'
import { useNow } from '../../hooks/data'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import { formatDuration, formatTime } from '../../domain/format'
import { applySuggestedPlacements, completeMorning } from './actions'
import { planPlacements, previewPlacements } from './logic'
import { EmptyNote } from './PlanControls'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'
import './ritual.css'

interface StepProps {
  pc: PlanContext
  nav: StepNav
}

const clock = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** ⑤ 시간 배치(F6) — 제안만 보여 주고, "적용"을 눌러야 작업에 시간이 적힌다 */
export function PlaceStep({ pc, nav }: StepProps) {
  const { ctx, settings, plan, capacityMin } = pc
  const [applied, setApplied] = useState(0)
  // 지금 시각이 지나 버린 자리를 제안하지 않도록 1분마다 새로 계산한다
  const now = useNow()
  const result = useMemo(
    () =>
      planPlacements(
        { ...ctx, now },
        {
          capacityMin,
          workStart: settings.workStart,
          workEnd: settings.workEnd,
          bufferMin: settings.bufferMin,
          defaultMin: settings.defaultDurationMin,
        },
      ),
    [ctx, now, capacityMin, settings.workStart, settings.workEnd, settings.bufferMin, settings.defaultDurationMin],
  )
  const previews = previewPlacements(result.placements, ctx.tasks)
  const byId = new Map(ctx.tasks.map((t) => [t.id, t]))
  const failures = result.failures.flatMap((f) => {
    const task = byId.get(f.taskId)
    return task ? [{ task, reason: f.reason }] : []
  })
  const done = plan.morningDoneAt !== null

  const apply = () => {
    applySuggestedPlacements(result.placements)
    setApplied(result.placements.length)
  }

  return (
    <StepFrame
      title="빈 시간에 배치하기"
      hint={`근무 시간(${settings.workStart}–${settings.workEnd})과 일 사이 ${settings.bufferMin}분 여유를 지켜 제안해요. 적용을 누르기 전에는 아무것도 바뀌지 않아요.`}
      nav={nav}
      finish={
        done ? (
          <Link to={paths.today} className="ritual-btn ritual-btn--primary">
            오늘 화면으로
          </Link>
        ) : (
          <button type="button" className="ritual-btn ritual-btn--primary" onClick={() => completeMorning(pc.today)}>
            아침 계획 마치기
          </button>
        )
      }
    >
      {done && plan.morningDoneAt !== null ? (
        <p className="plan-done" role="status">
          아침 계획을 마쳤어요 · {clock(plan.morningDoneAt)}
        </p>
      ) : null}
      {previews.length > 0 ? (
        <>
          <h3 className="plan-sub">
            제안 미리보기 <span>{previews.length}</span>
          </h3>
          <ol className="plan-preview" aria-label="배치 제안 미리보기">
            {previews.map(({ placement, task, endTime }) => (
              <li key={task.id} className="plan-preview__item">
                <p className="plan-preview__time">
                  {formatTime(placement.startTime, settings.timeFormat)}
                  <span aria-hidden="true">–</span>
                  <span className="sr-only"> 부터 </span>
                  {formatTime(endTime, settings.timeFormat)}
                </p>
                <p className="plan-preview__title">{task.title}</p>
                <p className="plan-preview__len">{formatDuration(placement.durationMin)}</p>
              </li>
            ))}
          </ol>
          <button type="button" className="ritual-btn ritual-btn--accent plan-bulk" onClick={apply}>
            {previews.length}개 적용하기
          </button>
        </>
      ) : (
        <EmptyNote>
          {applied > 0 ? `${applied}개에 시간을 정했어요. 오늘 화면에서 확인할 수 있어요.` : '시간을 정할 일이 없어요. 시간 없이 하루 중에 해도 괜찮아요.'}
        </EmptyNote>
      )}
      {failures.length > 0 ? (
        <>
          <h3 className="plan-sub">
            자리를 못 찾은 일 <span>{failures.length}</span>
          </h3>
          <ul className="plan-failures">
            {failures.map(({ task, reason }) => (
              <li key={task.id}>
                <p className="plan-failures__title">{task.title}</p>
                <p className="plan-failures__reason">{reason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </StepFrame>
  )
}
