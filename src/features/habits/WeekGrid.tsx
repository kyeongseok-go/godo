import { Check } from 'lucide-react'
import { useRef } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { habitWeekProgress } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { cellLabel } from './habitView'

const LONG_PRESS_MS = 450

interface WeekGridProps {
  habit: Habit
  weekStart: ISODate
  today: ISODate
  onToggle: (date: ISODate) => void
  /** count 습관에서 길게 누르거나 우클릭하면 값을 직접 입력하는 창을 연다 */
  onEditValue: (date: ISODate, anchor: HTMLElement) => void
}

/** 이번 주 7칸. 각 칸은 이름을 가진 체크박스이고, 완료는 색과 함께 체크 표시로 전달한다. */
export function WeekGrid({ habit, weekStart, today, onToggle, onEditValue }: WeekGridProps) {
  const timer = useRef<number | null>(null)
  const pressed = useRef(false)
  const isCount = habit.goal.kind === 'count'

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, date: ISODate) => {
    if (!isCount || date > today || e.button > 0) return
    const target = e.currentTarget
    pressed.current = false
    clearTimer()
    timer.current = window.setTimeout(() => {
      pressed.current = true
      onEditValue(date, target)
    }, LONG_PRESS_MS)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const cells = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="checkbox"]') ?? [])
    const next = cells[cells.indexOf(e.currentTarget) + (e.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  return (
    <div className="hgrid" role="group" aria-label={`${habit.name} 이번 주 기록`}>
      {habitWeekProgress(habit, weekStart).map((cell) => {
        const future = cell.date > today
        const partial = !cell.done && cell.value > 0
        return (
          <button
            key={cell.date}
            type="button"
            role="checkbox"
            aria-checked={cell.done}
            aria-disabled={future || undefined}
            aria-label={cellLabel(habit, cell.date)}
            className="hcell"
            data-done={cell.done}
            data-partial={partial}
            data-due={cell.due}
            data-today={cell.date === today}
            data-future={future}
            style={habit.color ? ({ '--habit': habit.color } as CSSProperties) : undefined}
            onClick={() => {
              if (pressed.current) {
                pressed.current = false
                return
              }
              if (!future) onToggle(cell.date)
            }}
            onContextMenu={(e) => {
              if (!isCount || future) return
              e.preventDefault()
              clearTimer()
              onEditValue(cell.date, e.currentTarget)
            }}
            onPointerDown={(e) => onPointerDown(e, cell.date)}
            onPointerUp={clearTimer}
            onPointerLeave={clearTimer}
            onPointerCancel={clearTimer}
            onKeyDown={onKeyDown}
          >
            {cell.done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}
            {partial ? <span className="hcell__value" aria-hidden="true">{cell.value}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
