import { addDays } from '../../domain/date'
import { upcomingSaturday, nextWeekStart } from '../../domain/calendarGrid'
import type { ISODate } from '../../domain/types'
import { CalendarGrid } from '../pickers/CalendarGrid'
import '../plan/ritual.css'
import './replan.css'

interface ReplanDatePanelProps {
  today: ISODate
  weekStartsOn: 0 | 1
  onSelect: (date: ISODate) => void
  onCancel: () => void
}

/** "다른 날로"를 눌렀을 때 카드 안에서 바로 날짜를 고르는 패널 */
export function ReplanDatePanel({ today, weekStartsOn, onSelect, onCancel }: ReplanDatePanelProps) {
  const quick: Array<{ label: string; date: ISODate }> = [
    { label: '내일', date: addDays(today, 1) },
    { label: '이번 주말', date: upcomingSaturday(today) },
    { label: '다음 주', date: nextWeekStart(today, weekStartsOn) },
  ]
  return (
    <section className="replan-date" aria-label="다시 잡을 날짜 고르기">
      <h2 className="replan-date__title">언제로 옮길까요?</h2>
      <div className="replan-date__quick">
        {quick.map((q) => (
          <button key={q.label} type="button" className="ritual-btn" onClick={() => onSelect(q.date)}>
            {q.label}
          </button>
        ))}
      </div>
      <CalendarGrid selected={null} today={today} weekStartsOn={weekStartsOn} onSelect={onSelect} />
      <button type="button" className="ritual-btn ritual-btn--quiet" onClick={onCancel}>
        돌아가기
        <kbd className="keycap" aria-hidden="true">
          Esc
        </kbd>
      </button>
    </section>
  )
}
