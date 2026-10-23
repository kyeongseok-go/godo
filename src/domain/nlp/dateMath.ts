// 파서 전용 날짜 계산. 기본 연산은 ../date 를 쓰고 여기서는 "다음 N번째 요일"류만 더한다.
import { addDays, addMonths, fromISODate, lastDayOfMonth, startOfWeek, toISODate, weekdayOf } from '../date'
import type { ISODate, Weekday } from '../types'

const MAX_YEAR_SCAN = 9

/** ISODate는 네 자리 연도만 담는다. 그 밖의 연도는 날짜로 보지 않는다. */
const MIN_YEAR = 1000
const MAX_YEAR = 9999

export function buildDate(year: number, month: number, day: number): ISODate | null {
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) return null
  // new Date(year, ...)는 연도 0~99를 1900년대로 바꾸므로 setFullYear로 연도를 그대로 넣는다.
  const date = new Date(2000, 0, 1)
  date.setFullYear(year, month - 1, day)
  return toISODate(date)
}

/** 주 시작 요일 기준으로 weekOffset주 뒤(음수면 앞) 그 주의 weekday */
export function weekBased(today: ISODate, weekOffset: number, weekday: Weekday, weekStartsOn: 0 | 1): ISODate {
  const index = (weekday - weekStartsOn + 7) % 7
  return addDays(startOfWeek(today, weekStartsOn), weekOffset * 7 + index)
}

/** 오늘 다음 날부터 세어 처음 만나는 weekday (오늘이 그 요일이면 7일 뒤) */
export function nextWeekdayAfter(today: ISODate, weekday: Weekday): ISODate {
  const delta = (weekday - weekdayOf(today) + 7) % 7 || 7
  return addDays(today, delta)
}

/** 오늘 포함해 처음 만나는 weekday */
export function nextWeekdayOnOrAfter(from: ISODate, weekday: Weekday): ISODate {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7)
}

/** 월·일만 주어졌을 때: 오늘 이후(오늘 포함) 처음 오는 유효한 날짜. 2월 29일은 다음 윤년으로 넘어간다. */
export function nextMonthDay(month: number, day: number, today: ISODate): ISODate | null {
  const startYear = fromISODate(today).getFullYear()
  for (let y = startYear; y <= startYear + MAX_YEAR_SCAN; y += 1) {
    const candidate = buildDate(y, month, day)
    if (candidate && candidate >= today) return candidate
  }
  return null
}

/** today가 속한 달에서 monthOffset달 뒤의 달의 첫날 */
function monthStart(today: ISODate, monthOffset: number): ISODate {
  const first = `${today.slice(0, 7)}-01`
  return addMonths(first, monthOffset)
}

/** monthOffset달 뒤 달의 day일. 그 달에 없는 일이면 말일로 맞춘다. 1일 이전으로는 넘어가지 않는다. */
export function dayOfMonth(today: ISODate, monthOffset: number, day: number): ISODate {
  const first = fromISODate(monthStart(today, monthOffset))
  const last = lastDayOfMonth(first.getFullYear(), first.getMonth() + 1)
  return addDays(toISODate(first), Math.min(Math.max(day, 1), last) - 1)
}

export function endOfMonth(today: ISODate, monthOffset: number): ISODate {
  return dayOfMonth(today, monthOffset, 31)
}

/** 달의 n번째 weekday. n=-1이면 마지막. */
export function nthWeekdayOfMonth(monthFirst: ISODate, n: 1 | 2 | 3 | 4 | -1, weekday: Weekday): ISODate {
  if (n > 0) {
    return addDays(nextWeekdayOnOrAfter(monthFirst, weekday), (n - 1) * 7)
  }
  const d = fromISODate(monthFirst)
  const lastIso = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  return addDays(lastIso, -((weekdayOf(lastIso) - weekday + 7) % 7))
}

export function monthFirstOf(today: ISODate, monthOffset: number): ISODate {
  return monthStart(today, monthOffset)
}
