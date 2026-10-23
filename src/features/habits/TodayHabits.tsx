import { Check, ChevronRight, Minus, Plus } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import { habitValue, isHabitDone } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { useSettings, useTable, useToday } from '../../hooks/data'
import { todayHabits } from './habitView'
import { useHabitActions } from './useHabitActions'
import type { HabitActions } from './useHabitActions'
import './today-habits.css'

interface ChipProps {
  habit: Habit
  today: ISODate
  actions: HabitActions
}

function CheckChip({ habit, today, actions }: ChipProps) {
  const done = isHabitDone(habit, today)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      className="thabit"
      data-done={done}
      style={{ '--habit': habit.color } as CSSProperties}
      onClick={() => actions.toggle(habit.id, today)}
    >
      <span className="thabit__mark" aria-hidden="true">
        {done ? <Check size={13} strokeWidth={3} /> : null}
      </span>
      <span className="thabit__name">{habit.name}</span>
    </button>
  )
}

function CountChip({ habit, today, actions }: ChipProps) {
  const value = habitValue(habit, today)
  const done = isHabitDone(habit, today)
  const ratio = Math.min(1, value / habit.goal.target)
  return (
    <div className="thabit thabit--count" role="group" aria-label={habit.name} data-done={done} style={{ '--habit': habit.color, '--ratio': ratio } as CSSProperties}>
      <button type="button" className="thabit__step" aria-label={`${habit.name} 1 줄이기`} disabled={value <= 0} onClick={() => actions.step(habit.id, today, -1)}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="thabit__name">{habit.name}</span>
      <output className="thabit__value" aria-label={`${habit.name} 오늘 ${value}, 목표 ${habit.goal.target}${habit.goal.unit ?? ''}`}>
        {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
        {value}/{habit.goal.target}
        {habit.goal.unit ?? ''}
      </output>
      <button type="button" className="thabit__step" aria-label={`${habit.name} 1 늘리기`} onClick={() => actions.step(habit.id, today, 1)}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

/** 오늘 화면에 끼우는 한 줄. 오늘 해야 하는 습관이 없으면 아무것도 그리지 않는다. */
export function TodayHabits() {
  const habits = useTable('habits')
  const today = useToday()
  const enabled = useSettings().modules.habits
  const actions = useHabitActions()
  const due = useMemo(() => todayHabits(habits, today), [habits, today])

  if (!enabled || due.length === 0) return null
  const doneCount = due.filter((h) => isHabitDone(h, today)).length

  return (
    <section className="today-habits" aria-label="오늘의 습관">
      <header className="today-habits__head">
        <h2>오늘의 습관</h2>
        <span aria-label={`${due.length}개 중 ${doneCount}개 완료`}>
          <b>{doneCount}</b>/{due.length}
        </span>
      </header>
      <ul className="today-habits__list">
        {due.map((habit) => (
          <li key={habit.id}>
            {habit.goal.kind === 'count' ? <CountChip habit={habit} today={today} actions={actions} /> : <CheckChip habit={habit} today={today} actions={actions} />}
          </li>
        ))}
      </ul>
      <Link to={paths.habits} className="today-habits__all" aria-label="습관 전체 보기">
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  )
}
