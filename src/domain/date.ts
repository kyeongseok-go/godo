// 로컬 달력 날짜 헬퍼. 'YYYY-MM-DD' 문자열을 기준으로 하고 Date 객체는 계산 때만 잠깐 쓴다.
import type { ISODate, TimeOfDay, Weekday } from './types'

const pad = (n: number): string => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = fromISODate(s)
  return toISODate(d) === s
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** 월 단위 이동. 대상 달에 그 일이 없으면 말일로 맞춘다(1/31 + 1달 = 2/28). */
export function addMonths(s: ISODate, n: number): ISODate {
  const d = fromISODate(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISODate(d)
}

export function addYears(s: ISODate, n: number): ISODate {
  return addMonths(s, n * 12)
}

export function weekdayOf(s: ISODate): Weekday {
  return fromISODate(s).getDay() as Weekday
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function startOfWeek(s: ISODate, weekStartsOn: 0 | 1): ISODate {
  const diff = (weekdayOf(s) - weekStartsOn + 7) % 7
  return addDays(s, -diff)
}

export function lastDayOfMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

export function compareDate(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isTimeOfDay(s: unknown): s is TimeOfDay {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

export function minutesOfDay(t: TimeOfDay): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function timeFromMinutes(total: number): TimeOfDay {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

/**
 * "오늘"의 기준 날짜. dayStartHour가 4이면 새벽 3시는 아직 어제로 본다.
 */
export function todayOf(now: Date, dayStartHour = 0): ISODate {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000)
  return toISODate(shifted)
}

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const
