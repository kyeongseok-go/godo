import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { firstOfMonth, monthGrid, shiftMonth, weekdayOrder } from '../../domain/calendarGrid'
import { WEEKDAY_KO } from '../../domain/date'
import { formatMonthTitle } from '../../domain/format'
import type { ISODate } from '../../domain/types'
import './calendar-grid.css'

interface CalendarGridProps {
  selected: ISODate | null
  today: ISODate
  weekStartsOn: 0 | 1
  onSelect: (date: ISODate) => void
  /** 날짜 아래에 점으로 표시할 날들(작업이 있는 날 등) */
  marked?: ReadonlySet<ISODate>
}

/** 한 달짜리 선택용 달력. 키보드로는 날짜 버튼 사이를 Tab으로 이동한다. */
export function CalendarGrid({ selected, today, weekStartsOn, onSelect, marked }: CalendarGridProps) {
  const [month, setMonth] = useState<ISODate>(firstOfMonth(selected ?? today))
  const grid = monthGrid(month, weekStartsOn)

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="cal__nav" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="cal__title" aria-live="polite">
          {formatMonthTitle(month)}
        </span>
        <button type="button" className="cal__nav" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="cal__weekdays" aria-hidden="true">
        {weekdayOrder(weekStartsOn).map((d) => (
          <span key={d} data-weekend={d === 0 || d === 6}>
            {WEEKDAY_KO[d]}
          </span>
        ))}
      </div>
      <div className="cal__grid" role="grid" aria-label={formatMonthTitle(month)}>
        {grid.flat().map((cell) => (
          <button
            key={cell.date}
            type="button"
            role="gridcell"
            className="cal__day"
            data-out={!cell.inMonth}
            data-today={cell.date === today}
            data-selected={cell.date === selected}
            data-marked={marked?.has(cell.date) ?? false}
            aria-label={cell.date}
            aria-selected={cell.date === selected}
            onClick={() => onSelect(cell.date)}
          >
            {Number(cell.date.slice(8))}
          </button>
        ))}
      </div>
    </div>
  )
}
