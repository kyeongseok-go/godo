// 월간 달력 격자 계산. 화면 컴포넌트와 분리해 두면 요일 시작·윤년 경계를 테스트로 잡을 수 있다.
import { addDays, addMonths, lastDayOfMonth, startOfWeek, toISODate } from './date'
import type { ISODate } from './types'

export interface CalendarCell {
  date: ISODate
  /** 표시 중인 달에 속하는지(앞뒤로 채운 날은 false) */
  inMonth: boolean
}

/** 해당 월의 첫날 */
export function firstOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`
}

export function shiftMonth(date: ISODate, delta: number): ISODate {
  return addMonths(firstOfMonth(date), delta)
}

/** 항상 6주(42칸)로 채워 달마다 높이가 흔들리지 않게 한다. */
export function monthGrid(anyDateInMonth: ISODate, weekStartsOn: 0 | 1): CalendarCell[][] {
  const first = firstOfMonth(anyDateInMonth)
  const start = startOfWeek(first, weekStartsOn)
  const weeks: CalendarCell[][] = []
  for (let w = 0; w < 6; w++) {
    const row: CalendarCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d)
      row.push({ date, inMonth: date.slice(0, 7) === first.slice(0, 7) })
    }
    weeks.push(row)
  }
  return weeks
}

/** 한 주(7일) 날짜 목록 */
export function weekDays(anyDateInWeek: ISODate, weekStartsOn: 0 | 1): ISODate[] {
  const start = startOfWeek(anyDateInWeek, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 요일 머리글 순서 (0=일요일) */
export function weekdayOrder(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)
}

export function daysInMonth(date: ISODate): number {
  const [y, m] = date.split('-').map(Number)
  return lastDayOfMonth(y, m)
}

/** 이번 주말(토요일). 이미 주말이면 가까운 토요일을 그대로 쓴다. */
export function upcomingSaturday(from: ISODate): ISODate {
  const dow = new Date(`${from}T00:00:00`).getDay()
  const delta = dow === 6 ? 0 : (6 - dow + 7) % 7
  return addDays(from, delta)
}

/** 다음 주 첫날(주 시작 요일 기준) */
export function nextWeekStart(from: ISODate, weekStartsOn: 0 | 1): ISODate {
  return addDays(startOfWeek(from, weekStartsOn), 7)
}

export { toISODate }
