// 반복 계산에 필요한 달력 헬퍼. date.ts에 없는 것만 여기 둔다(date.ts는 수정 금지).
import { lastDayOfMonth, weekdayOf } from '../date'
import type { ISODate, Weekday } from '../types'

export interface YMD {
  year: number
  month: number // 1~12
  day: number
}

const pad = (n: number): string => String(n).padStart(2, '0')

export function parseYMD(s: ISODate): YMD {
  const [year, month, day] = s.split('-').map(Number)
  return { year, month, day }
}

export function formatYMD(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** 월요일=0 … 일요일=6. 한국 달력 관행에 맞춰 일요일을 주의 끝으로 둔다. */
export function mondayIndex(weekday: Weekday): number {
  return (weekday + 6) % 7
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

/** 그 달에 없는 일(31일 등)은 말일로 보정한다. 'last'는 말일. */
export function dayOfMonthClamped(year: number, month: number, day: number | 'last'): ISODate {
  const last = lastDayOfMonth(year, month)
  const resolved = day === 'last' ? last : Math.min(day, last)
  return formatYMD(year, month, resolved)
}

/** n번째(1~4) 또는 마지막(-1) 요일의 날짜. */
export function nthWeekdayOfMonth(year: number, month: number, n: 1 | 2 | 3 | 4 | -1, weekday: Weekday): ISODate {
  if (n === -1) {
    const last = lastDayOfMonth(year, month)
    const lastWeekday = weekdayOf(formatYMD(year, month, last))
    return formatYMD(year, month, last - ((lastWeekday - weekday + 7) % 7))
  }
  const firstWeekday = weekdayOf(formatYMD(year, month, 1))
  return formatYMD(year, month, 1 + ((weekday - firstWeekday + 7) % 7) + 7 * (n - 1))
}
