// 필터의 날짜 표현식("2026-10-30", "10월 30일", "Oct 30", "내일", "monday" ...)을 읽고 푼다.
import { addDays, lastDayOfMonth, startOfWeek, toISODate, weekdayOf } from '../date'
import type { ISODate, Weekday } from '../types'
import type { DateExpr } from './ast'

export type DateParse = { ok: true; expr: DateExpr } | { ok: false; message: string }

const MAX_OFFSET = 36_500
/** 연도를 모를 때 2월 29일을 허용하기 위한 윤년 */
const LEAP_YEAR = 2024

const OFFSET_WORDS: ReadonlyMap<string, number> = new Map([
  ['today', 0],
  ['tomorrow', 1],
  ['tmr', 1],
  ['yesterday', -1],
  ['오늘', 0],
  ['내일', 1],
  ['모레', 2],
  ['어제', -1],
  ['그저께', -2],
])

const WEEKDAY_WORDS: ReadonlyMap<string, Weekday> = new Map([
  ['sunday', 0], ['sun', 0], ['일요일', 0],
  ['monday', 1], ['mon', 1], ['월요일', 1],
  ['tuesday', 2], ['tue', 2], ['tues', 2], ['화요일', 2],
  ['wednesday', 3], ['wed', 3], ['수요일', 3],
  ['thursday', 4], ['thu', 4], ['thur', 4], ['thurs', 4], ['목요일', 4],
  ['friday', 5], ['fri', 5], ['금요일', 5],
  ['saturday', 6], ['sat', 6], ['토요일', 6],
])

const MONTH_WORDS: ReadonlyMap<string, number> = new Map([
  ['jan', 1], ['january', 1], ['feb', 2], ['february', 2], ['mar', 3], ['march', 3],
  ['apr', 4], ['april', 4], ['may', 5], ['jun', 6], ['june', 6], ['jul', 7], ['july', 7],
  ['aug', 8], ['august', 8], ['sep', 9], ['sept', 9], ['september', 9],
  ['oct', 10], ['october', 10], ['nov', 11], ['november', 11], ['dec', 12], ['december', 12],
])

const ok = (expr: DateExpr): DateParse => ({ ok: true, expr })

export function parseDateExpr(input: string): DateParse {
  const raw = input.trim()
  const text = raw.toLowerCase().replace(/\s+/g, ' ')
  const parsed = parseRelative(text) ?? parseWeekday(text) ?? parseCalendar(text)
  return parsed ?? { ok: false, message: `날짜를 해석할 수 없습니다: "${raw}"` }
}

function parseRelative(text: string): DateParse | null {
  const word = OFFSET_WORDS.get(text)
  if (word !== undefined) return ok({ kind: 'offset', days: word })
  const compact = text.replace(/ /g, '')
  if (compact === 'nextweek' || compact === '다음주') return ok({ kind: 'nextWeek' })
  return parseOffsetPhrase(text)
}

/** `in 3 days` `3 days ago` `2 weeks ago` `3일 후` `2주 전` */
function parseOffsetPhrase(text: string): DateParse | null {
  const patterns: Array<[RegExp, number]> = [
    [/^in (\d{1,5}) days?$/, 1],
    [/^(\d{1,5}) days? ago$/, -1],
    [/^(\d{1,5}) ?일 ?(?:후|뒤)$/, 1],
    [/^(\d{1,5}) ?일 ?전$/, -1],
    [/^in (\d{1,5}) weeks?$/, 7],
    [/^(\d{1,5}) weeks? ago$/, -7],
    [/^(\d{1,5}) ?주 ?(?:후|뒤)$/, 7],
    [/^(\d{1,5}) ?주 ?전$/, -7],
  ]
  for (const [pattern, unit] of patterns) {
    const match = pattern.exec(text)
    if (!match) continue
    const days = Number(match[1]) * unit
    if (Math.abs(days) > MAX_OFFSET) return { ok: false, message: `날짜 범위가 너무 큽니다: "${text}"` }
    return ok({ kind: 'offset', days })
  }
  return null
}

function parseWeekday(text: string): DateParse | null {
  const weekday = WEEKDAY_WORDS.get(text)
  return weekday === undefined ? null : ok({ kind: 'weekday', weekday })
}

function parseCalendar(text: string): DateParse | null {
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text)
  if (iso) return calendar(text, Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const korean = /^(?:(\d{4}) ?년 ?)?(\d{1,2}) ?월 ?(\d{1,2}) ?일?$/.exec(text)
  if (korean) return calendar(text, yearOf(korean[1]), Number(korean[2]), Number(korean[3]))

  const numeric = /^(\d{1,2})[/.](\d{1,2})(?:\/(\d{4}))?$/.exec(text)
  if (numeric) return calendar(text, yearOf(numeric[3]), Number(numeric[1]), Number(numeric[2]))

  const monthFirst = /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(text)
  if (monthFirst) return namedMonth(text, monthFirst[1], monthFirst[2], monthFirst[3])

  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?(?: (\d{4}))?$/.exec(text)
  if (dayFirst) return namedMonth(text, dayFirst[2], dayFirst[1], dayFirst[3])

  return null
}

const yearOf = (digits: string | undefined): number | undefined =>
  digits === undefined ? undefined : Number(digits)

function namedMonth(
  text: string,
  monthWord: string,
  day: string,
  year: string | undefined,
): DateParse | null {
  const month = MONTH_WORDS.get(monthWord)
  return month === undefined ? null : calendar(text, yearOf(year), month, Number(day))
}

function calendar(text: string, year: number | undefined, month: number, day: number): DateParse {
  const limit = month >= 1 && month <= 12 ? lastDayOfMonth(year ?? LEAP_YEAR, month) : 0
  if (day < 1 || day > limit) {
    return { ok: false, message: `존재하지 않는 날짜입니다: "${text}"` }
  }
  if (year === undefined) return ok({ kind: 'monthDay', month, day })
  const pad = (n: number): string => String(n).padStart(2, '0')
  return ok({ kind: 'iso', date: `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}` })
}

/** 표현식을 실제 날짜로 푼다. 순수 함수이며 today는 호출자가 준다. */
export function resolveDateExpr(expr: DateExpr, today: ISODate, weekStartsOn: 0 | 1): ISODate {
  switch (expr.kind) {
    case 'iso':
      return expr.date
    case 'offset':
      return addDays(today, expr.days)
    case 'weekday':
      return addDays(today, (expr.weekday - weekdayOf(today) + 7) % 7)
    case 'nextWeek':
      return addDays(startOfWeek(today, weekStartsOn), 7)
    case 'monthDay': {
      const year = Number(today.slice(0, 4))
      const day = Math.min(expr.day, lastDayOfMonth(year, expr.month))
      return toISODate(new Date(year, expr.month - 1, day))
    }
  }
}
