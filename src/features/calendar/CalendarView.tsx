import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { shiftMonth, weekDays } from '../../domain/calendarGrid'
import { addDays, isISODate } from '../../domain/date'
import { formatMonthTitle } from '../../domain/format'
import type { ISODate, Task } from '../../domain/types'
import { useSettings, useToday } from '../../hooks/data'
import type { QuickAddDefaults } from '../../store/ui'
import { dateRange, occurrencesByDate } from './layout'
import { MonthGrid } from './MonthGrid'
import { TimeGrid } from './TimeGrid'
import './calendar-view.css'

type Mode = 'day' | 'week' | 'month'
const MODES: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: 'day', label: '일' },
  { id: 'week', label: '주' },
  { id: 'month', label: '월' },
]

interface CalendarViewProps {
  tasks: readonly Task[]
  defaults?: QuickAddDefaults
}

/** 월 / 주 / 일 캘린더. 보는 날짜와 모드는 URL(?cal=, ?date=)에 둔다. */
export function CalendarView({ tasks, defaults }: CalendarViewProps) {
  const today = useToday()
  const { weekStartsOn } = useSettings()
  const [params, setParams] = useSearchParams()
  const rawMode = params.get('cal')
  const mode: Mode = rawMode === 'day' || rawMode === 'week' ? rawMode : 'month'
  const rawDate = params.get('date')
  const anchor: ISODate = isISODate(rawDate) ? rawDate : today

  const set = (patch: { cal?: Mode; date?: ISODate }) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        const cal = patch.cal ?? mode
        const date = patch.date ?? anchor
        if (cal === 'month') next.delete('cal')
        else next.set('cal', cal)
        if (date === today) next.delete('date')
        else next.set('date', date)
        return next
      },
      { replace: true },
    )

  const move = (dir: 1 | -1) => {
    if (mode === 'month') set({ date: shiftMonth(anchor, dir) })
    else set({ date: addDays(anchor, dir * (mode === 'week' ? 7 : 1)) })
  }

  const days = useMemo(() => (mode === 'day' ? [anchor] : mode === 'week' ? weekDays(anchor, weekStartsOn) : []), [mode, anchor, weekStartsOn])
  // 월간은 6주(42일)를 모두 덮도록 앞뒤로 여유를 두고 전개한다.
  const range = useMemo<[ISODate, ISODate]>(() => {
    if (mode === 'month') {
      const first = `${anchor.slice(0, 7)}-01`
      return [addDays(first, -7), addDays(first, 42 + 7)]
    }
    return [days[0], days[days.length - 1]]
  }, [mode, anchor, days])
  const occurrences = useMemo(() => occurrencesByDate(tasks, range[0], range[1]), [tasks, range])

  const title = mode === 'month' ? formatMonthTitle(anchor) : mode === 'day' ? anchor : `${days[0].slice(5).replace('-', '/')} – ${days[6].slice(5).replace('-', '/')}`

  return (
    <div className="calview">
      <div className="calview__bar">
        <div className="calview__nav">
          <button type="button" className="icon-btn" aria-label="이전" onClick={() => move(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label="다음" onClick={() => move(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn-ghost" onClick={() => set({ date: today })}>
            오늘
          </button>
          <h2 aria-live="polite">{title}</h2>
        </div>
        <div className="vswitch" role="tablist" aria-label="달력 단위">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => set({ cal: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'month' ? (
        <MonthGrid anchor={anchor} today={today} occurrences={occurrences} defaults={defaults} />
      ) : (
        <TimeGrid days={mode === 'day' ? dateRange(anchor, 1) : days} today={today} occurrences={occurrences} defaults={defaults} />
      )}
    </div>
  )
}
