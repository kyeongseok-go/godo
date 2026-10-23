import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, WEEKDAY_KO, weekdayOf } from '../../domain/date'
import type { ISODate } from '../../domain/types'
import { formatWeekRange } from './habitView'

const DAYS_PER_WEEK = 7

interface WeekToolbarProps {
  weekStart: ISODate
  isCurrentWeek: boolean
  onMove: (direction: -1 | 1) => void
  onToday: () => void
}

/** 주 이동 막대: 이전 / 다음 / 이번 주로 + 보고 있는 주 범위 */
export function WeekToolbar({ weekStart, isCurrentWeek, onMove, onToday }: WeekToolbarProps) {
  return (
    <div className="hweek-bar">
      <button type="button" className="icon-btn" aria-label="이전 주" onClick={() => onMove(-1)}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" aria-label="다음 주" onClick={() => onMove(1)}>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <button type="button" className="btn-ghost" onClick={onToday} disabled={isCurrentWeek}>
        이번 주로
      </button>
      <h2 aria-live="polite">{formatWeekRange(weekStart)}</h2>
    </div>
  )
}

/** 각 습관 줄의 7칸과 같은 칼럼에 맞춘 요일 머리글 */
export function WeekdayHead({ weekStart, today }: { weekStart: ISODate; today: ISODate }) {
  return (
    <div className="hlist__head" aria-hidden="true">
      <div className="hlist__days">
        {Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
          const date = addDays(weekStart, i)
          return (
            <span key={date} className="hlist__day" data-today={date === today}>
              {WEEKDAY_KO[weekdayOf(date)]}
              <b>{Number(date.slice(8))}</b>
            </span>
          )
        })}
      </div>
    </div>
  )
}
