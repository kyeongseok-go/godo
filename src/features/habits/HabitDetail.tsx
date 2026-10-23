import { Archive, Minus, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { addDays } from '../../domain/date'
import { habitCompletionRate, habitStreak, habitValue } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { Heatmap } from './Heatmap'
import { habitMeta } from './habitView'
import type { HabitActions } from './useHabitActions'

const HEATMAP_WEEKS = 12
const RATE_DAYS = 30
const PERCENT = 100

interface HabitDetailProps {
  habit: Habit
  today: ISODate
  weekStart: ISODate
  weekStartsOn: 0 | 1
  actions: HabitActions
  onEdit: () => void
  onClose: () => void
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="hdetail__stat">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <span>{unit}</span>
      </dd>
    </div>
  )
}

/** 오늘 기록: check 는 켬/끔 버튼, count 는 −/+ 와 직접 입력. 값이 바뀌면 key 로 다시 만들어 입력칸을 맞춘다. */
function TodayRecord({ habit, today, actions }: { habit: Habit; today: ISODate; actions: HabitActions }) {
  const value = habitValue(habit, today)
  const [text, setText] = useState(String(value))

  if (habit.goal.kind === 'check') {
    return (
      <button type="button" className="btn-ghost hdetail__today" aria-pressed={value > 0} onClick={() => actions.toggle(habit.id, today)}>
        {value > 0 ? '오늘 완료 취소' : '오늘 완료로 기록'}
      </button>
    )
  }
  const commitText = () => {
    const parsed = Number(text)
    if (text.trim() === '' || !Number.isFinite(parsed) || parsed < 0) setText(String(value))
    else if (parsed !== value) actions.write(habit.id, today, parsed)
  }
  return (
    <div className="hdetail__stepper" role="group" aria-label="오늘 값">
      <button type="button" className="icon-btn" aria-label="1 줄이기" onClick={() => actions.step(habit.id, today, -1)}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        aria-label={`오늘 ${habit.name} 값`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="hdetail__unit">
        / {habit.goal.target}
        {habit.goal.unit ?? ''}
      </span>
      <button type="button" className="icon-btn" aria-label="1 늘리기" onClick={() => actions.step(habit.id, today, 1)}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function HabitDetail({ habit, today, weekStart, weekStartsOn, actions, onEdit, onClose }: HabitDetailProps) {
  const streak = habitStreak(habit, today)
  const rate = habitCompletionRate(habit, addDays(today, -(RATE_DAYS - 1)), today)

  return (
    <section className="hdetail" aria-label={`${habit.name} 자세히`} style={{ '--habit': habit.color } as CSSProperties}>
      <header className="hdetail__head">
        <div>
          <h2>
            <span className="hrow__dot" aria-hidden="true" />
            {habit.name}
          </h2>
          <p>{habitMeta(habit, weekStart)}</p>
        </div>
        <button type="button" className="icon-btn hdetail__close" aria-label="자세히 닫기" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <dl className="hdetail__stats">
        <Stat label="현재 연속" value={String(streak.current)} unit="일" />
        <Stat label="최장 연속" value={String(streak.longest)} unit="일" />
        <Stat label={`최근 ${RATE_DAYS}일 달성률`} value={String(Math.round(rate * PERCENT))} unit="%" />
      </dl>
      <div className="hdetail__block">
        <h3>오늘 기록</h3>
        <TodayRecord key={`${habit.id}:${habitValue(habit, today)}`} habit={habit} today={today} actions={actions} />
      </div>
      <div className="hdetail__block">
        <h3>최근 {HEATMAP_WEEKS}주</h3>
        <Heatmap habit={habit} today={today} weeks={HEATMAP_WEEKS} weekStartsOn={weekStartsOn} />
        <p className="hdetail__legend" aria-hidden="true">
          적음
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className="hdetail__swatch" data-level={level} />
          ))}
          목표 달성
        </p>
      </div>
      <footer className="hdetail__foot">
        <button type="button" className="btn-ghost" onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" /> 편집
        </button>
        <button type="button" className="btn-ghost" onClick={() => actions.archive(habit.id, true)}>
          <Archive size={15} aria-hidden="true" /> 보관
        </button>
      </footer>
    </section>
  )
}
