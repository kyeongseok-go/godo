import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTable } from '../../hooks/data'
import { describeDate } from '../../domain/format'
import { completeEvening } from './actions'
import { recentReflections } from './logic'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'
import './ritual.css'

interface StepProps {
  pc: PlanContext
  nav: StepNav
}

const MAX_REFLECTION = 280

const clock = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** ③ 한 줄 회고 + 지난 7일 회고 모아보기(접힘) */
export function ReflectStep({ pc, nav }: StepProps) {
  const { today, plan } = pc
  const [text, setText] = useState(plan.reflection)
  const plans = useTable('dayPlans')
  const past = recentReflections(plans, today)
  const done = plan.eveningDoneAt !== null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    completeEvening(today, text)
  }

  return (
    <StepFrame
      title="한 줄 회고"
      hint="오늘을 한 줄로 남겨 봐요. 잘한 것 하나, 내일 바꿀 것 하나면 충분해요."
      nav={nav}
    >
      <form className="plan-reflect" onSubmit={submit}>
        <label htmlFor="plan-reflection">오늘은 어땠나요?</label>
        <textarea
          id="plan-reflection"
          value={text}
          maxLength={MAX_REFLECTION}
          rows={3}
          placeholder="예: 오전에 집중이 잘 됐다. 내일은 회의 전에 보고서부터."
          onChange={(e) => setText(e.target.value)}
        />
        <p className="plan-reflect__count" aria-hidden="true">
          {text.length} / {MAX_REFLECTION}
        </p>
        <div className="plan-reflect__actions">
          <button type="submit" className="ritual-btn ritual-btn--primary">
            {done ? '회고 고쳐 저장' : '저녁 회고 마치기'}
          </button>
          {done && plan.eveningDoneAt !== null ? (
            <p className="plan-done" role="status">
              오늘 회고를 마쳤어요 · {clock(plan.eveningDoneAt)}
            </p>
          ) : null}
        </div>
      </form>
      <details className="plan-past">
        <summary>지난 7일 회고 {past.length > 0 ? `(${past.length})` : ''}</summary>
        {past.length > 0 ? (
          <ol>
            {past.map((p) => (
              <li key={p.date}>
                <time dateTime={p.date}>{describeDate(p.date, today)}</time>
                <p>{p.reflection}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="plan-empty">아직 남긴 회고가 없어요. 오늘 한 줄부터 시작해 봐요.</p>
        )}
      </details>
    </StepFrame>
  )
}
