import { Check, ChevronRight, Minus, Plus } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import { timeFromMinutes } from '../../domain/date'
import { formatTime } from '../../domain/format'
import { planHabitBlocks, scheduledOn } from '../../domain/planning'
import { habitValue, isHabitDone } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { busyFromTimedTasks } from '../plan/logic'
import { useJustChanged } from '../../hooks/flash'
import { useNow, useSettings, useTable, useToday } from '../../hooks/data'
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
  // 눌러서 숫자가 바뀐 그 순간에만 한 번 솟았다 내려온다.
  const bumped = useJustChanged(value)
  return (
    <div className="thabit thabit--count" role="group" aria-label={habit.name} data-done={done} style={{ '--habit': habit.color, '--ratio': ratio } as CSSProperties}>
      <button type="button" className="thabit__step" aria-label={`${habit.name} 1 줄이기`} disabled={value <= 0} onClick={() => actions.step(habit.id, today, -1)}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="thabit__name">{habit.name}</span>
      <output className="thabit__value" data-bump={bumped || undefined} aria-label={`${habit.name} 오늘 ${value}, 목표 ${habit.goal.target}${habit.goal.unit ?? ''}`}>
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

const SLOT_MIN = 15

/**
 * F12: 블록이 있는 습관에 오늘 비워 둔 시간. 시각이 정해진 할 일을 피해 1분마다 다시 계산한다.
 * 분 단위로 바뀌므로 칩 목록과 떨어진 작은 컴포넌트로 두어, 칩이 매분 다시 그려지지 않게 한다.
 */
function HabitBlockNote({ due, today }: { due: readonly Habit[]; today: ISODate }) {
  const tasks = useTable('tasks')
  const settings = useSettings()
  const now = useNow()
  const blocks = useMemo(() => {
    if (!due.some((h) => h.block !== null)) return []
    const scheduled = tasks.filter((t) => scheduledOn(t, today))
    return planHabitBlocks(due, busyFromTimedTasks(scheduled, today, settings.defaultDurationMin), {
      date: today,
      nowTime: timeFromMinutes(now.getHours() * 60 + now.getMinutes()),
      bufferMin: settings.bufferMin,
      slotMin: SLOT_MIN,
    }).blocks
  }, [due, tasks, today, now, settings.bufferMin, settings.defaultDurationMin])

  if (blocks.length === 0) return null
  const byId = new Map(due.map((h) => [h.id, h]))
  return (
    <p className="today-habits__blocks">
      비워 둔 시간{' '}
      {blocks.map((block, i) => (
        <span key={block.habitId}>
          {i > 0 ? ' · ' : null}
          <b>{formatTime(block.startTime, settings.timeFormat)}</b> {byId.get(block.habitId)?.name}
        </span>
      ))}
    </p>
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
      <HabitBlockNote due={due} today={today} />
      <Link to={paths.habits} className="today-habits__all" aria-label="습관 전체 보기">
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  )
}
